import { NextResponse } from "next/server";
import { currentBillingHotel } from "../../../../../lib/billing/current-hotel";
import { createPaypalSubscription, paypalPlanId } from "../../../../../lib/billing/paypal";
import { discountedAmount, validCoupon } from "../../../../../lib/billing/coupons";
import { paypalConfiguration } from "../../../../../lib/billing/paypal";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  const user = await currentBillingHotel(true);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (["ACTIVE","COMPED"].includes(user.hotelTenant.subscriptionStatus)) return NextResponse.json({ error: "ALREADY_ACTIVE" }, { status: 409 });
  try {
    const body=await request.json().catch(()=>null),couponCode=typeof body?.couponCode==="string"?body.couponCode:"",coupon=couponCode?await validCoupon(couponCode):null,configuration=await paypalConfiguration();
    if(couponCode&&!coupon)return NextResponse.json({error:"INVALID_COUPON"},{status:400});
    if(coupon?.percentOff===100)return NextResponse.json({error:"APPLY_FREE_COUPON_FIRST"},{status:400});
    if(coupon){const prior=await prisma.couponRedemption.findFirst({where:{hotelTenantId:user.hotelTenantId},select:{couponId:true}});if(prior&&prior.couponId!==coupon.id)return NextResponse.json({error:"COUPON_ALREADY_USED"},{status:409})}
    const amount=coupon?discountedAmount(configuration.price,coupon.percentOff):undefined;
    const paypal = await createPaypalSubscription(user.hotelTenantId,amount);
    if (!paypal.id || paypal.plan_id !== await paypalPlanId() || paypal.custom_id !== user.hotelTenantId) throw new Error("PayPal returned an invalid subscription.");
    await prisma.$transaction(async tx=>{
      if(coupon){const existing=await tx.couponRedemption.findUnique({where:{couponId_hotelTenantId:{couponId:coupon.id,hotelTenantId:user.hotelTenantId}}});if(!existing){const updated=await tx.coupon.updateMany({where:{id:coupon.id,isActive:true,...(coupon.maxRedemptions!==null?{redemptionCount:{lt:coupon.maxRedemptions}}:{})},data:{redemptionCount:{increment:1}}});if(!updated.count)throw new Error("COUPON_LIMIT");await tx.couponRedemption.create({data:{couponId:coupon.id,hotelTenantId:user.hotelTenantId,originalAmount:configuration.price,discountedAmount:amount!,currencyCode:configuration.currency,paypalSubscriptionId:paypal.id}})}}
      await tx.subscription.upsert({
        where: { providerSubscriptionId: paypal.id },
        create: { hotelTenantId: user.hotelTenantId, providerSubscriptionId: paypal.id, providerPlanId: paypal.plan_id, status: "APPROVAL_PENDING" },
        update: { providerPlanId: paypal.plan_id, status: "APPROVAL_PENDING" },
      });
      await tx.hotelTenant.update({ where: { id: user.hotelTenantId }, data: { subscriptionStatus: "APPROVAL_PENDING", paypalSubscriptionId: paypal.id, paypalPlanId: paypal.plan_id } });
    });
    return NextResponse.json({ subscriptionId: paypal.id });
  } catch (error) {
    console.error("Could not create PayPal subscription", error);
    return NextResponse.json({ error: "PAYPAL_UNAVAILABLE" }, { status: 502 });
  }
}
