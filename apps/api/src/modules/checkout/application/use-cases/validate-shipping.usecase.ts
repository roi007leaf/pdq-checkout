import { Injectable } from "@nestjs/common";
import { UseCase } from "../../../../common/application/use-case.base";
import { ShippingAddressDto } from "../dtos/shipping-address.dto";
import { ShippingService } from "../services/shipping.service";

export interface ValidatedShipping {
  valid: boolean;
  shippingAddress: ShippingAddressDto;
  estimatedDelivery: string;
}

@Injectable()
export class ValidateShippingUseCase extends UseCase<
  ShippingAddressDto,
  ValidatedShipping
> {
  constructor(private readonly shippingService: ShippingService) {
    super(ValidateShippingUseCase.name);
  }

  protected async executeImpl(
    dto: ShippingAddressDto
  ): Promise<ValidatedShipping> {
    // Use the service to validate the address
    const isValid = await this.shippingService.validateAddress(dto);

    if (!isValid) {
      throw new Error("Invalid shipping address");
    }

    // Use the service to estimate delivery
    const deliveryDate = await this.shippingService.estimateDelivery(dto);

    return {
      valid: true,
      shippingAddress: dto,
      estimatedDelivery: deliveryDate.toISOString().split("T")[0],
    };
  }
}
