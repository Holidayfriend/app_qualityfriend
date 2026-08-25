import { deleteEntity, updateEntity } from "../../../../../lib/settings/entity-service";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) { return updateEntity(request, "team", (await params).id); }
export async function DELETE(_request: Request, { params }: Context) { return deleteEntity("team", (await params).id); }
