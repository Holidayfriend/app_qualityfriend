"use client";
import {useParams} from "next/navigation";
import {HousekeepingUI} from "../../../../components/housekeeping/housekeeping-ui";
export default function Page(){const params=useParams<{roomNumber:string}>();return <HousekeepingUI view="room-detail" roomNumber={params.roomNumber}/>}
