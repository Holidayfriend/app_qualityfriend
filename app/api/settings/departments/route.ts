import { createEntity, listEntities } from "../../../../lib/settings/entity-service";
export function GET() { return listEntities("department"); }
export function POST(request: Request) { return createEntity(request, "department"); }
