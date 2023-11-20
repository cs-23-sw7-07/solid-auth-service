import { Agent } from "solid-interoperability";
import { AccessNeedGroup } from "./access-need-group";
import { DataAccessScope } from "./data-access-scope";

export class Approval {
  constructor(
    public agent: Agent,
    public access: Map<AccessNeedGroup, DataAccessScope[]>,
  ) {}
}
