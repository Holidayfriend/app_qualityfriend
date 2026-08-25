import { listDeletedItems } from "../../../../lib/recycle-bin/recycle-bin-service";

export function GET() { return listDeletedItems(); }
