export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: Category;
  image?: string;
  variations?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  allowCustomText?: boolean;
  allowNotes?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  selectedVariations: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  customText?: string;
  notes?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}
