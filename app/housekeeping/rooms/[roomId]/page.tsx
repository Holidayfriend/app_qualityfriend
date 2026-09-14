"use client";
import {useParams} from "next/navigation";
import {HousekeepingUI} from "../../../../components/housekeeping/housekeeping-ui";
export default function Page(){const params=useParams<{roomId:string}>();return <HousekeepingUI view="room-detail" roomId={params.roomId}/>}
