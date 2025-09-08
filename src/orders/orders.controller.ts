import { Controller, NotImplementedException, ParseUUIDPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderPaginationDTO } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto, PaidOrderDto } from './dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern('createOrder')
  async create(@Payload() createOrderDto: CreateOrderDto) {

    const order = await this.ordersService.create(createOrderDto);

    const paymentSession = await this.ordersService.createPaymentSession(order)

    return {
      order,
      paymentSession,
    }
  }

  @MessagePattern('findAllOrders')
  findAll(@Payload() OrderPaginationDTO: OrderPaginationDTO ) {
    return this.ordersService.findAll(OrderPaginationDTO);
  }

  @MessagePattern('findOneOrder')
  findOne(@Payload('id', ParseUUIDPipe ) id: string ) {
    return this.ordersService.findOne(id);
  }
  
  @MessagePattern('chancheOrderStatus')
  changeOrderStatus(@Payload() changeOrderStatus: ChangeOrderStatusDto){
    return this.ordersService.changeStatus(changeOrderStatus)
  }

  @EventPattern('payment.succeeded')
  paidOrder(@Payload() paidOrderDto: PaidOrderDto){

    return this.ordersService.paidOrder(paidOrderDto);
    
  }

}
