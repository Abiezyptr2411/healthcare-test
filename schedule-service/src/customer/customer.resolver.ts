import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { CustomerService } from './customer.service';
import { Customer } from './entities/customer.entity';
import { CustomerPagination } from './entities/customer-pagination.entity';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { PaginationArgs } from '../common/dto/pagination.args';

@Resolver(() => Customer)
export class CustomerResolver {
  constructor(private readonly customerService: CustomerService) {}

  @Mutation(() => Customer, {
    description: 'Create a new customer (patient) profile in the healthcare system',
  })
  async createCustomer(
    @Args('input') input: CreateCustomerInput,
  ): Promise<Customer> {
    return this.customerService.createCustomer(input);
  }

  @Mutation(() => Customer, {
    description: 'Update customer details (name, email) by ID',
  })
  async updateCustomer(
    @Args('input') input: UpdateCustomerInput,
  ): Promise<Customer> {
    return this.customerService.updateCustomer(input);
  }

  @Query(() => CustomerPagination, {
    description: 'Retrieve a paginated list of registered customers',
  })
  async customers(
    @Args() pagination: PaginationArgs,
  ): Promise<CustomerPagination> {
    return this.customerService.customers(pagination);
  }

  @Query(() => Customer, {
    description: 'Find a specific customer by their UUID',
  })
  async customer(
    @Args('id', { type: () => ID, description: 'Customer UUID' }) id: string,
  ): Promise<Customer> {
    return this.customerService.customer(id);
  }

  @Mutation(() => Customer, {
    description: 'Delete a customer profile. Fails if the customer has existing schedules',
  })
  async deleteCustomer(
    @Args('id', { type: () => ID, description: 'Customer UUID to delete' })
    id: string,
  ): Promise<Customer> {
    return this.customerService.deleteCustomer(id);
  }
}

