import { AccessNeedGroup, Agent } from "solid-interoperability";
import { DataAccessScope } from "./data-access-scope";

export class Approval {
    constructor(
        public agent: Agent,
        public access: Map<AccessNeedGroup, DataAccessScope[]>,
    ) {}
}
