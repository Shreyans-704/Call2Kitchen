-- Run after 20261021180000_create_restaurants_and_menu_items.sql.
-- Demo data only: prices are not claims about any real restaurant.
-- Stable UUIDs plus DO NOTHING make reruns safe from duplicates and avoid
-- overwriting records that someone may have edited after the initial seed.

insert into public.restaurants (id, name, phone, address, is_open)
values (
  '00000000-0000-4000-8000-000000000001',
  'Spice Garden',
  '+91-98765-43210',
  '42 Market Road, Demo City',
  true
)
on conflict (id) do nothing;

insert into public.menu_items (
  id, restaurant_id, name, description, price, category, is_available, allergens
)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Vegetable Samosa', 'Crisp pastry filled with spiced potatoes and peas', 90.00, 'Starters', true, '["gluten"]'::jsonb),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Paneer Tikka', 'Char-grilled cottage cheese with peppers and onions', 210.00, 'Starters', true, '["dairy"]'::jsonb),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Paneer Butter Masala', 'Paneer in a rich tomato and butter gravy', 260.00, 'Main Course', true, '["dairy", "cashew"]'::jsonb),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'Dal Tadka', 'Yellow lentils tempered with garlic and spices', 190.00, 'Main Course', true, '[]'::jsonb),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'Veg Biryani', 'Fragrant basmati rice with vegetables and spices', 240.00, 'Main Course', true, '["dairy"]'::jsonb),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'Butter Naan', 'Tandoor-baked flatbread finished with butter', 55.00, 'Breads', true, '["gluten", "dairy"]'::jsonb),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'Garlic Naan', 'Tandoor-baked flatbread with garlic and coriander', 65.00, 'Breads', false, '["gluten"]'::jsonb),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 'Mango Lassi', 'Chilled yogurt drink blended with mango', 110.00, 'Beverages', true, '["dairy"]'::jsonb),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000001', 'Masala Chai', 'Indian tea simmered with aromatic spices', 45.00, 'Beverages', true, '["dairy"]'::jsonb),
  ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000001', 'Gulab Jamun', 'Milk dumplings in cardamom syrup', 120.00, 'Desserts', true, '["dairy", "gluten"]'::jsonb)
on conflict (id) do nothing;
