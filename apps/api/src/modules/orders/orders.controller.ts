import { Controller, Get, Param } from "@nestjs/common";
import { GetOrderUseCase } from "./application/use-cases/get-order.usecase";

@Controller("orders")
export class OrdersController {
  constructor(private readonly getOrderUseCase: GetOrderUseCase) {}

  @Get(":id")
  async getOrder(@Param("id") id: string) {
    return this.getOrderUseCase.execute(id);
  }
}
