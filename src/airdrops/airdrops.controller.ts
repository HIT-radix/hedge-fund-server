import { Controller } from "@nestjs/common";
import { AirdropsService } from "./airdrops.service";

@Controller("airdrops")
export class AirdropsController {
  constructor(private readonly airdropsService: AirdropsService) {}
}
