export type MenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  price: string;
  category: string;
  isAvailable: boolean;
  allergens: string[];
};

export interface MenuRepository {
  listAvailable(): Promise<MenuItem[]>;
  findAvailableById(id: string): Promise<MenuItem | null>;
  findByIds(ids: string[]): Promise<MenuItem[]>;
}
