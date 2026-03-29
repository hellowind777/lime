import React from "react";
import {
  applyInitialSkillCatalogBootstrap,
  subscribeSkillCatalogBootstrap,
} from "@/lib/skillCatalogBootstrap";

export function useSkillCatalogBootstrap(): void {
  React.useEffect(() => {
    applyInitialSkillCatalogBootstrap();
    return subscribeSkillCatalogBootstrap();
  }, []);
}
