import { deliveryServiceFromText } from './serviceAliases.js';
import type { DeliveryParserItem } from './types.js';

export function matchProductsToOrder(items: DeliveryParserItem[], order: any) {
  const warnings: string[] = [];
  const deliveredCountByItem = new Map<string, number>();
  for (const delivery of order.deliveries || []) {
    deliveredCountByItem.set(delivery.order_item_id, (deliveredCountByItem.get(delivery.order_item_id) || 0) + 1);
  }
  const assignedCountByItem = new Map<string, number>();
  const availableQuantity = (orderItem: any) =>
    Math.max((orderItem.quantity || 1) - (deliveredCountByItem.get(orderItem.id) || 0) - (assignedCountByItem.get(orderItem.id) || 0), 0);

  const matched = items.map((item) => {
    const hasAccessData = Boolean((item.delivered_email || item.delivered_user) && item.delivered_password);
    if (!hasAccessData) {
      return { ...item, needsReview: true };
    }
    const detected = deliveryServiceFromText(item.serviceName);
    const matches = (order.items || []).filter((orderItem: any) => {
      const service = deliveryServiceFromText(`${orderItem.product_name} ${orderItem.product?.brand_key || ''}`);
      return detected?.key && service?.key === detected.key;
    });
    const availableMatches = matches.filter((match: any) => availableQuantity(match) > 0);
    const selected = availableMatches.length === 1 ? availableMatches[0] : availableMatches[0] || matches[0];
    if (!selected || availableQuantity(selected) <= 0) {
      const reason = 'Este servicio no pertenece a la orden seleccionada.';
      warnings.push(`${item.serviceName}: producto no compatible con la orden seleccionada.`);
      return { ...item, needsReview: true, incompatible: true, incompatibleReason: reason };
    }
    if (matches.length > 1) warnings.push(`${item.serviceName}: hay varios productos similares en el pedido.`);
    assignedCountByItem.set(selected.id, (assignedCountByItem.get(selected.id) || 0) + 1);
    return {
      ...item,
      matchedProductId: selected.product_id,
      matchedOrderItemId: selected.id,
      needsReview: item.needsReview || matches.length > 1
    };
  });
  return { items: matched, warnings };
}
