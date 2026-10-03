import { Controller, Get, Header } from "@nestjs/common";

export type HealthResponse = { status: "ok" };

@Controller()
export class HealthController {
  @Get("health")
  @Header("Cache-Control", "no-store")
  health(): HealthResponse {
    return { status: "ok" };
  }
}
