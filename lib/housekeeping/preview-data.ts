export type RoomStatus = "dirty" | "cleaning" | "clean" | "inspected";
export type Room = { number:string; floor:string; category:string; status:RoomStatus; occupied?:boolean; express?:boolean; dnd?:boolean; noService?:boolean; cleaner?:string; arrival?:string; departure?:string; guest?:string; language?:string; remark?:string };

export const rooms: Room[] = [
  {number:"42",floor:"1",category:"Deluxe double room",status:"clean",occupied:true,guest:"Wagner family",language:"DE",arrival:"18 Aug 2026",departure:"25 Aug 2026"},
  {number:"43",floor:"1",category:"Comfort double room",status:"inspected",cleaner:"Rebecca",departure:"Today, checked out",guest:"Egger family"},
  {number:"44",floor:"1",category:"Deluxe double room",status:"cleaning",occupied:true,cleaner:"Rebecca",guest:"Mr Brunner",language:"DE",remark:"Nut allergy",arrival:"15 Aug 2026",departure:"22 Aug 2026"},
  {number:"45",floor:"1",category:"Lake-view suite",status:"dirty",express:true,cleaner:"Sabine Moser",arrival:"Today, 14:00"},
  {number:"46",floor:"1",category:"Comfort double room",status:"inspected",arrival:"Today, 15:00",guest:"Resch family"},
  {number:"47",floor:"1",category:"Comfort double room",status:"clean"},
  {number:"48",floor:"1",category:"Deluxe double room",status:"dirty",occupied:true,dnd:true,cleaner:"Rebecca",guest:"Jendrike Cart",language:"DE",remark:"Travelling with a dog"},
  {number:"50",floor:"1",category:"Comfort double room",status:"clean",occupied:true,noService:true,guest:"Ms Steiner",language:"IT"},
  {number:"51",floor:"1",category:"Lake-view suite",status:"dirty",express:true,cleaner:"Sabine Moser",departure:"Today, checked out"},
  {number:"52",floor:"1",category:"Comfort double room",status:"clean"},
  {number:"55",floor:"2",category:"Deluxe double room",status:"inspected",cleaner:"Housekeeping 2"},
  {number:"56",floor:"2",category:"Comfort double room",status:"clean"},
  {number:"57",floor:"2",category:"Deluxe double room",status:"clean",occupied:true,guest:"Jendrike Cart",language:"DE"},
  {number:"58",floor:"2",category:"Comfort double room",status:"clean",cleaner:"Housekeeping 2"},
  {number:"60",floor:"2",category:"Single room",status:"inspected",arrival:"Today, 16:00",guest:"Mr Plattner"},
  {number:"61",floor:"2",category:"Single room",status:"clean",occupied:true,arrival:"Today, checked in",guest:"Mr Toifl",language:"DE"},
];
export const cleaners=[{name:"Rebecca",minutes:120,rooms:["43","44","45","48"]},{name:"Solav",minutes:0,rooms:[]},{name:"Ameen",minutes:0,rooms:[]},{name:"Housekeeping1",minutes:0,rooms:[]},{name:"Housekeeping2",minutes:135,rooms:["55","58"],extra:"Fenster Parterre/Finestre pianterreno"},{name:"Jana",minutes:0,rooms:[]},{name:"Sabine Moser",minutes:45,rooms:["51"]}];
export const categories=[{name:"Comfort double room (no lake view)",express:20,normal:30,departure:45,final:60},{name:"Deluxe double room with lake view",express:25,normal:35,departure:50,final:70},{name:"Suite with lake view",express:30,normal:45,departure:60,final:90},{name:"Single room",express:15,normal:25,departure:35,final:50}];
export const extraJobs=[["Sistemare i mirocleaner/Miccleaner riordinare",20],["Hausladele",15],["Kuschelnest reinigen",20],["Fenster Speisesaal/Finestre sala da pranzo",30],["Fenster-Finestre Pool/Kuschelnest",25],["Reinigung Sauna/Pulizia intensiva sauna prima delle camere",40],["Gänge/Corridoi (abstauben, Spinnweben, Fenster)",30],["Balkone nass wischen und Spinnweben",35],["Fenster Stall/Finestre Stalla",20],["Abfluss - Scarichi",15],["Spakabinen - Camere per trattamenti Spa",30],["Holzhütte - Casetta di legno",15],["Tennishütte - Casetta campo da Tennis",15],["Sauna",20],["Fenster Parterre/Finestre pianterreno",60]] as const;
