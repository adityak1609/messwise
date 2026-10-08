import snapshot from '../data/weekly-menu.json';
import type { WasteRecord } from './domain';

export const MENU_MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;
export type MenuMeal = typeof MENU_MEALS[number];
export type DailyMenu = Record<MenuMeal, string>;
type PublishedDay = Record<MenuMeal, string[]>;

// A dated snapshot of the user's supplied menu, never repeated in later weeks.
export const WEEKLY_MENU = snapshot;
export function publishedMenu(date: string): PublishedDay | null {
  return Object.hasOwn(snapshot.days, date) ? (snapshot.days as Record<string, PublishedDay>)[date] : null;
}
export function dailyMenu(date: string): DailyMenu {
  const day = publishedMenu(date);
  return Object.fromEntries(MENU_MEALS.map(meal => [meal, day?.[meal].join(', ') ?? ''])) as DailyMenu;
}
export function normalizeMenu(menu: WasteRecord['menu']): DailyMenu {
  return { ...menu, snacks: menu.snacks ?? '' };
}
export function parseDishes(value: string): string[] {
  return value.split(/[,\n]/).map(name => name.trim()).filter(Boolean);
}
export function menuSuggestions(date: string, meal: MenuMeal): string[] {
  const items = publishedMenu(date)?.[meal] ?? [];
  // Separate listed alternatives so a reviewer selects the serving they had.
  const names = items.flatMap(item => item.split(/[,/]/)).map(name => name.trim())
    .filter(name => name && name.length <= 100 && name !== 'SPECIAL BREAKFAST');
  return [...new Map(names.map(name => [name.toLowerCase(), name])).values()];
}
