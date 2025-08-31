import { IsEnum, isEnum, IsOptional } from "class-validator";
import { OrderStatus } from "generated/prisma";
import { PaginationDto } from "src/common";
import { OrderStatusList } from "./enum/order.enum";

export class OrderPaginationDTO extends PaginationDto{

    @IsOptional()
    @IsEnum( OrderStatusList, {
        message: `Valid status are ${ OrderStatusList }`
    })
    status: OrderStatus;
}