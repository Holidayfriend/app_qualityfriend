import { createEntity, listEntities } from "../../../../lib/settings/entity-service";
export function GET() { return listEntities("team"); }
export function POST(request: Request) { return createEntity(request, "team"); }
