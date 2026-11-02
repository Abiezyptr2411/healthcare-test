import { Test, TestingModule } from '@nestjs/testing';
import { CustomerResolver } from './customer.resolver';
import { CustomerService } from './customer.service';

describe('CustomerResolver', () => {
  let resolver: CustomerResolver;
  let service: CustomerService;

  const mockCustomer = {
    id: 'cust-1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCustomerService = {
    createCustomer: jest.fn(),
    updateCustomer: jest.fn(),
    customers: jest.fn(),
    customer: jest.fn(),
    deleteCustomer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerResolver,
        { provide: CustomerService, useValue: mockCustomerService },
      ],
    }).compile();

    resolver = module.get<CustomerResolver>(CustomerResolver);
    service = module.get<CustomerService>(CustomerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should call createCustomer', async () => {
    mockCustomerService.createCustomer.mockResolvedValue(mockCustomer);
    const input = { name: 'John Doe', email: 'john@example.com' };
    const res = await resolver.createCustomer(input);
    expect(mockCustomerService.createCustomer).toHaveBeenCalledWith(input);
    expect(res).toEqual(mockCustomer);
  });

  it('should call updateCustomer', async () => {
    mockCustomerService.updateCustomer.mockResolvedValue(mockCustomer);
    const input = { id: 'cust-1', name: 'John Doe Updated' };
    const res = await resolver.updateCustomer(input);
    expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(input);
    expect(res).toEqual(mockCustomer);
  });

  it('should call customers', async () => {
    const mockPagination = {
      items: [mockCustomer],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };
    mockCustomerService.customers.mockResolvedValue(mockPagination);
    const res = await resolver.customers({ page: 1, limit: 10 });
    expect(mockCustomerService.customers).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(res).toEqual(mockPagination);
  });

  it('should call customer', async () => {
    mockCustomerService.customer.mockResolvedValue(mockCustomer);
    const res = await resolver.customer('cust-1');
    expect(mockCustomerService.customer).toHaveBeenCalledWith('cust-1');
    expect(res).toEqual(mockCustomer);
  });

  it('should call deleteCustomer', async () => {
    mockCustomerService.deleteCustomer.mockResolvedValue(mockCustomer);
    const res = await resolver.deleteCustomer('cust-1');
    expect(mockCustomerService.deleteCustomer).toHaveBeenCalledWith('cust-1');
    expect(res).toEqual(mockCustomer);
  });
});

