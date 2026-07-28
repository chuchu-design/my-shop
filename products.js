// 預設商品資料
const products = [
  { id: 1, name: "周邊商品 A", price: 350 },
  { id: 2, name: "周邊商品 B", price: 420 },
  { id: 3, name: "周邊商品 C", price: 180 }
];

// --- 購物車邏輯 ---
function getCart() {
  return JSON.parse(localStorage.getItem('cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  saveCart(cart);
  alert(`已加入購物車：${product.name}`);
  if (typeof renderCart === 'function') renderCart();
}

// --- 訂單與轉單邏輯 ---
function getOrders() {
  return JSON.parse(localStorage.getItem('orders') || '[]');
}

function saveOrders(orders) {
  localStorage.setItem('orders', JSON.stringify(orders));
}

// 團員下單（自動產生 6 位數字轉單驗證碼）
function submitOrder(memberName, memberPhone) {
  const cart = getCart();
  if (cart.length === 0) {
    alert("購物車是空的！");
    return false;
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const verifyCode = Math.floor(100000 + Math.random() * 900000).toString(); // 隨機驗證碼

  const newOrder = {
    id: "ORD" + Date.now().toString().slice(-6),
    memberName,
    memberPhone,
    items: cart,
    total,
    verifyCode,
    createdAt: new Date().toLocaleString('zh-TW')
  };

  const orders = getOrders();
  orders.push(newOrder);
  saveOrders(orders);

  localStorage.removeItem('cart'); // 清空購物車
  return newOrder;
}

// 轉單驗證機制
function transferOrder(orderId, inputCode, newName, newPhone) {
  const orders = getOrders();
  const orderIndex = orders.findIndex(o => o.id === orderId);

  if (orderIndex === -1) {
    return { success: false, msg: "找不到該筆訂單編號！" };
  }

  const order = orders[orderIndex];
  if (order.verifyCode !== inputCode) {
    return { success: false, msg: "驗證碼不正確，請向原團員確認！" };
  }

  // 驗證成功：變更所有權並更新驗證碼
  order.memberName = newName;
  order.memberPhone = newPhone;
  order.verifyCode = Math.floor(100000 + Math.random() * 900000).toString(); // 自動刷新驗證碼
  orders[orderIndex] = order;
  saveOrders(orders);

  return { success: true, msg: "🎉 轉單成功！訂單已轉移至您的名下。" };
}