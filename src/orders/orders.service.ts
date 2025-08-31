import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDTO } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';
import { NATS_SERVICE, PRODUCT_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';


@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrdersService');

  constructor(
    @Inject(NATS_SERVICE) private readonly client: ClientProxy,
  ){
    super();
  }


  async onModuleInit() {
      await this.$connect();
      this.logger.log('Database Connected');
  }

  async create(createOrderDto: CreateOrderDto) {

    try{

      //1. Confirmar los Ids de los productos
      const productIds = createOrderDto.items.map( item => item.productId)
      const products: any[] = await firstValueFrom (
        this.client.send({cmd: 'validate_products'}, productIds)
      );

      //2. Cálculos de los valores
      const totalAmount = createOrderDto.items.reduce( (acc, orderItem) => {
        const price = products.find(
          ( product ) => product.id == orderItem.productId, 
        ).price;

        return price * orderItem.quantity;

      }, 0);

      const totalItems = createOrderDto.items.reduce( (acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0);

      //Crear transacción a Base de Datos, Inserción que sea exitosa 

      const order = await this.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map( (orderItem) => ({
                price: products.find( (product) => product.id == orderItem.productId).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity
              })),
            },
          },
          status: 'PENDING'
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId:true
            }
          }
        }
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map( (orderItem) => ({
          ...orderItem,
          name: products.find( product => product.id == orderItem.productId ).name
        })),
      };

    }catch(error){
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Check logs'
      });


    }
  }

  async findAll(orderPaginationDTO: OrderPaginationDTO) {

    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDTO.status
      }
    });

    const currentPage = orderPaginationDTO.page;
    const perPage = orderPaginationDTO.limit;

    return {
      data: await this.order.findMany({
        skip: ( currentPage - 1) * perPage,
        take: perPage,
        where:{
          status: orderPaginationDTO.status
        }
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastpage: Math.ceil( totalPages / perPage)
      }
    }
  }


  async findOne(id: string) {
    
    const order = await this.order.findFirst({
      where: { id },
      include:{
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true
          }
        }
      }
    });

    if ( !order ){
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order whit id ${ id } not found`
      });
    }

    const productIds = order.OrderItem.map( orderItem => orderItem.productId);
    const products: any[] = await firstValueFrom (
        this.client.send({cmd: 'validate_products'}, productIds)
      );

    return {
        ...order,
        OrderItem: order.OrderItem.map( (orderItem) => ({
          ...orderItem,
          name: products.find( product => product.id == orderItem.productId ).name
        })),
      };

  }

  async changeStatus( chancheOrderStatusDto: ChangeOrderStatusDto){
    const {id, status} = chancheOrderStatusDto;

    const order = await this.findOne(id);


    return this.order.update({
      where: {id},
      data: { status: status}
    })
  }

}
