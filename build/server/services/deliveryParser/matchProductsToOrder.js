import { deliveryServiceFromText } from './serviceAliases.js';
export function matchProductsToOrder(items, order) {
    const warnings = [];
    const deliveredCountByItem = new Map();
    for (const delivery of order.deliveries || []) {
        deliveredCountByItem.set(delivery.order_item_id, (deliveredCountByItem.get(delivery.order_item_id) || 0) + 1);
    }
    const assignedCountByItem = new Map();
    const availableQuantity = (orderItem) => Math.max((orderItem.quantity || 1) - (deliveredCountByItem.get(orderItem.id) || 0) - (assignedCountByItem.get(orderItem.id) || 0), 0);
    const matched = items.map((item) => {
        const detected = deliveryServiceFromText(item.serviceName);
        const matches = (order.items || []).filter((orderItem) => {
            const service = deliveryServiceFromText(`${orderItem.product_name} ${orderItem.product?.brand_key || ''}`);
            return detected?.key && service?.key === detected.key;
        });
        const availableMatches = matches.filter((match) => availableQuantity(match) > 0);
        const selected = availableMatches.length === 1 ? availableMatches[0] : availableMatches[0] || matches[0];
        if (!selected || availableQuantity(selected) <= 0) {
            const reason = 'Este servicio no pertenece a la orden seleccionada.';
            warnings.push(`${item.serviceName}: producto no compatible con la orden seleccionada.`);
            return { ...item, needsReview: true, incompatible: true, incompatibleReason: reason };
        }
        if (matches.length > 1)
            warnings.push(`${item.serviceName}: hay varios productos similares en el pedido.`);
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
