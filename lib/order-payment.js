"use strict";
/**
 * Customer-wallet contribution to an order (pure rules, no I/O).
 *
 * Rule (keeps driver earnings/settlement untouched): the wallet can only pay the GOODS part
 * (subtotal − discount). The delivery fee is always paid on delivery, because the driver keeps
 * it from the cash he collects. The driver therefore collects `amountDueOnDelivery` and is
 * charged goods-due minus the wallet part (see promo.goodsDue).
 */
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** @returns {{ok:true,amount:number}|{ok:false,status:number,code:string,error:string}} */
function walletShare({ balance, subtotal, discount = 0, requested }) {
  if (!requested) return { ok: true, amount: 0 };
  const goods = money(Math.max(0, Number(subtotal || 0) - Number(discount || 0)));
  const avail = money(Math.max(0, Number(balance || 0)));
  if (!(avail > 0)) return { ok: false, status: 409, code: "WALLET_EMPTY", error: "Wallet balance is empty" };
  let amount = Math.min(avail, goods);
  if (typeof requested === "number" || (typeof requested === "string" && requested.trim() !== "" && !isNaN(Number(requested)))) {
    const want = money(requested);
    if (!(want > 0)) return { ok: false, status: 400, code: "BAD_WALLET_AMOUNT", error: "Invalid wallet amount" };
    if (want > avail) return { ok: false, status: 409, code: "WALLET_INSUFFICIENT", error: "Wallet balance is not enough" };
    amount = Math.min(want, goods);
  }
  return { ok: true, amount: money(amount) };
}

/** Payment snapshot stored on the order. */
function snapshot({ total, deliveryFee, walletAmount, method, ledgerRef, at }) {
  const w = money(walletAmount || 0);
  return {
    method,
    walletAmount: w,
    amountDueOnDelivery: money(Math.max(0, Number(total) - w)),
    status: w > 0 ? "partially_paid_wallet" : "pay_on_delivery",
    reference: w > 0 ? ledgerRef : null,
    walletRefundedAt: null,
    at,
  };
}

const walletRefundRef = (orderId) => `order:${orderId}:wallet_refund`;
const walletPayRef = (orderId) => `order:${orderId}:wallet`;

/** Does a canceled order still owe its wallet portion back? */
const needsRefund = (order) =>
  !!order && order.status === "canceled" && Number(order.payment && order.payment.walletAmount) > 0 && !(order.payment && order.payment.walletRefundedAt);

module.exports = { walletShare, snapshot, walletRefundRef, walletPayRef, needsRefund };
