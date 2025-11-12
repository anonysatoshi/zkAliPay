'use client';

import { CreateOrderForm } from '@/components/orders/CreateOrderForm';
import { MyOrders } from '@/components/seller/MyOrders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SellPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Seller Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">
          Create sell orders and manage your funds
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Order</TabsTrigger>
          <TabsTrigger value="manage">My Orders</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create" className="mt-6">
          <CreateOrderForm />
        </TabsContent>
        
        <TabsContent value="manage" className="mt-6">
          <MyOrders />
        </TabsContent>
      </Tabs>
    </div>
  );
}

