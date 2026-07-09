import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BellDot,
  Clock3,
  Home,
  LayoutGrid,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
  Wallet
} from 'lucide-react';

const fallbackRestaurants = [
  {
    id: 1,
    name: 'Pizza Corner',
    cuisine: 'Italian • Pizza',
    rating: 4.8,
    time: '15 mins',
    status: 'Open',
    description: 'Wood-fired crusts, signature pies, and indulgent sides.',
    cover: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
    logo: '🍕',
    type: 'veg',
    color: 'from-orange-500 to-amber-400',
    categories: ['Pizza', 'Burgers', 'Garlic Bread', 'Drinks'],
    items: [
      { id: 101, name: 'Margherita Pizza', description: 'Fresh mozzarella with basil.', price: 299, rating: 4.9, veg: true, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80' },
      { id: 102, name: 'Pepperoni Feast', description: 'Crispy edges and bold spice.', price: 349, rating: 4.7, veg: false, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80' },
      { id: 103, name: 'Garlic Bread', description: 'Buttery toasted loaf with herbs.', price: 129, rating: 4.6, veg: true, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80' }
    ]
  },
  {
    id: 2,
    name: 'Juice Point',
    cuisine: 'Beverages • Healthy',
    rating: 4.6,
    time: '8 mins',
    status: 'Open',
    description: 'Fresh cold-pressed juices, smoothies, and mocktails.',
    cover: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80',
    logo: '🥤',
    type: 'veg',
    color: 'from-cyan-500 to-sky-400',
    categories: ['Juices', 'Smoothies', 'Mocktails', 'Fresh'],
    items: [
      { id: 201, name: 'Orange Juice', description: 'Freshly squeezed citrus comfort.', price: 99, rating: 4.8, veg: true, image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=900&q=80' },
      { id: 202, name: 'Green Detox', description: 'Cucumber, spinach, and apple.', price: 129, rating: 4.7, veg: true, image: 'https://images.unsplash.com/photo-1574170608850-94af138b7bc4?auto=format&fit=crop&w=900&q=80' }
    ]
  },
  {
    id: 3,
    name: 'Dessert House',
    cuisine: 'Desserts • Sweet',
    rating: 4.9,
    time: '12 mins',
    status: 'Open',
    description: 'Rich cakes, pastries, and signature sweet treats.',
    cover: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80',
    logo: '🍰',
    type: 'veg',
    color: 'from-pink-500 to-rose-400',
    categories: ['Cakes', 'Desserts', 'Ice Cream', 'Coffee'],
    items: [
      { id: 301, name: 'Chocolate Cake', description: 'Velvety chocolate sponge and ganache.', price: 149, rating: 4.9, veg: true, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80' },
      { id: 302, name: 'Berry Cheesecake', description: 'Creamy with a bright berry layer.', price: 169, rating: 4.8, veg: true, image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80' }
    ]
  },
  {
    id: 4,
    name: 'Biryani Bay',
    cuisine: 'Indian • Rice Bowls',
    rating: 4.7,
    time: '20 mins',
    status: 'Busy',
    description: 'Slow-cooked biryanis and spice-rich curries.',
    cover: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=900&q=80',
    logo: '🍛',
    type: 'non-veg',
    color: 'from-red-500 to-orange-400',
    categories: ['Biryani', 'Curries', 'Rice', 'Sides'],
    items: [
      { id: 401, name: 'Hyderabadi Biryani', description: 'Layered rice with tender spices.', price: 229, rating: 4.8, veg: false, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80' },
      { id: 402, name: 'Paneer Butter Masala', description: 'Creamy tomato gravy with paneer.', price: 199, rating: 4.7, veg: true, image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=80' }
    ]
  }
];

const paymentMethods = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash'];
const defaultCovers = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80'
];
const defaultColors = ['from-orange-500 to-amber-400', 'from-cyan-500 to-sky-400', 'from-pink-500 to-rose-400', 'from-red-500 to-orange-400'];
const defaultLogos = ['🍕', '🥤', '🍰', '🍛'];

function loadPurchaseCounts() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('tastyfoods-popularity');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistPurchaseCounts(counts) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('tastyfoods-popularity', JSON.stringify(counts));
}

function normalizeRestaurant(restaurant, index = 0) {
  const items = Array.isArray(restaurant.items)
    ? restaurant.items.map((item, itemIndex) => ({
        id: item.id ?? item.menuItemId ?? itemIndex + 1,
        name: item.name || item.item_name || 'Chef Special',
        description: item.description || item.desc || 'Freshly prepared with care.',
        price: Number(item.price || 0),
        rating: Number(item.rating || 4.5),
        veg: item.veg ?? true,
        image: item.image || item.imageUrl || defaultCovers[(index + itemIndex) % defaultCovers.length],
        cat: item.cat || item.category || 'Featured'
      }))
    : [];

  const categories = Array.isArray(restaurant.categories) && restaurant.categories.length
    ? restaurant.categories
    : Array.from(new Set(items.map((item) => String(item.cat || 'Featured').trim()).filter(Boolean)));

  return {
    id: Number(restaurant.id || index + 1),
    code: restaurant.code || restaurant.slug || `restaurant-${index + 1}`,
    name: restaurant.name || 'Restaurant',
    cuisine: restaurant.cuisine || restaurant.cuisines || 'Multi cuisine',
    rating: Number(restaurant.rating || 4.5),
    time: restaurant.time || '15 mins',
    status: restaurant.status || (restaurant.acceptingOrders === false ? 'Busy' : 'Open'),
    description: restaurant.description || restaurant.address || 'Freshly prepared dishes and quick delivery.',
    cover: restaurant.cover || restaurant.imageUrl || defaultCovers[index % defaultCovers.length],
    logo: restaurant.logo || defaultLogos[index % defaultLogos.length],
    type: restaurant.type || 'veg',
    color: restaurant.color || defaultColors[index % defaultColors.length],
    categories: categories.length ? categories : ['Featured'],
    items
  };
}

function App() {
  const [restaurants, setRestaurants] = useState(fallbackRestaurants);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [cart, setCart] = useState({});
  const [activeView, setActiveView] = useState('home');
  const [search, setSearch] = useState('');
  const [checkoutStage, setCheckoutStage] = useState('cart');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [purchaseCounts, setPurchaseCounts] = useState(loadPurchaseCounts);

  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        const response = await fetch('/api/public/restaurants');
        const payload = await response.json();
        const liveRestaurants = Array.isArray(payload?.restaurants) ? payload.restaurants : [];
        if (!liveRestaurants.length) return;
        const withMenus = await Promise.all(liveRestaurants.map(async (restaurant, index) => {
          try {
            const menuResponse = await fetch(`/api/menu?restaurant=${encodeURIComponent(restaurant.code || restaurant.name)}`);
            const menuItems = await menuResponse.json();
            return normalizeRestaurant({ ...restaurant, items: Array.isArray(menuItems) ? menuItems : [] }, index);
          } catch {
            return normalizeRestaurant(restaurant, index);
          }
        }));
        setRestaurants(withMenus);
      } catch {
        setRestaurants(fallbackRestaurants);
      }
    };

    loadRestaurants();
  }, []);

  useEffect(() => {
    persistPurchaseCounts(purchaseCounts);
  }, [purchaseCounts]);

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((restaurant) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return restaurant.name.toLowerCase().includes(q)
        || restaurant.cuisine.toLowerCase().includes(q)
        || (restaurant.items || []).some((item) => item.name.toLowerCase().includes(q));
    });
  }, [restaurants, search]);

  const popularItems = useMemo(() => {
    return restaurants
      .flatMap((restaurant) => (restaurant.items || []).map((item) => ({
        ...item,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        popularity: (purchaseCounts[`${restaurant.id}:${item.id}`] || 0) + (item.rating * 2)
      })))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 4);
  }, [restaurants, purchaseCounts]);

  const cartItems = Object.values(cart);
  const groupedCart = useMemo(() => {
    const groups = {};
    cartItems.forEach((entry) => {
      if (!groups[entry.restaurantId]) groups[entry.restaurantId] = [];
      groups[entry.restaurantId].push(entry);
    });
    return groups;
  }, [cartItems]);

  const grandTotal = useMemo(() => {
    return cartItems.reduce((total, entry) => total + entry.price * entry.quantity, 0) + 45 + 18;
  }, [cartItems]);

  const addToCart = (restaurant, item) => {
    const key = `${restaurant.id}:${item.id}`;
    setPurchaseCounts((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    setCart((prev) => {
      const existing = prev[key];
      if (existing) {
        return { ...prev, [key]: { ...existing, quantity: existing.quantity + 1 } };
      }
      return { ...prev, [key]: { restaurantId: restaurant.id, restaurantName: restaurant.name, itemId: item.id, itemName: item.name, price: item.price, quantity: 1, veg: item.veg } };
    });
    setActiveView('cart');
  };

  const changeQuantity = (id, delta) => {
    setCart((prev) => {
      const item = prev[id];
      if (!item) return prev;
      const nextQuantity = item.quantity + delta;
      if (nextQuantity <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...item, quantity: nextQuantity } };
    });
  };

  const proceedToCheckout = () => {
    setCheckoutStage('checkout');
    setActiveView('cart');
  };

  const placeOrder = () => {
    setPurchaseCounts((prev) => {
      const next = { ...prev };
      cartItems.forEach((entry) => {
        const key = `${entry.restaurantId}:${entry.itemId}`;
        next[key] = (next[key] || 0) + entry.quantity;
      });
      return next;
    });
    setOrderPlaced(true);
    setCheckoutStage('success');
    setActiveView('cart');
  };

  const openRestaurant = async (restaurant) => {
    if ((restaurant.items || []).length) {
      setSelectedRestaurant(restaurant);
      setActiveView('menu');
      return;
    }

    try {
      const response = await fetch(`/api/menu?restaurant=${encodeURIComponent(restaurant.code || restaurant.name)}`);
      const menuItems = await response.json();
      setSelectedRestaurant(normalizeRestaurant({ ...restaurant, items: Array.isArray(menuItems) ? menuItems : [] }, Number(restaurant.id)));
    } catch {
      setSelectedRestaurant(normalizeRestaurant(restaurant, Number(restaurant.id)));
    }
    setActiveView('menu');
  };

  const renderHome = () => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4 pb-24 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-[0_20px_60px_rgba(255,107,0,0.12)]">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300 p-5 text-white sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-100">Premium Food Court</p>
              <h1 className="text-3xl font-black sm:text-4xl">TastyFoods</h1>
            </div>
            <div className="rounded-2xl bg-white/20 p-3 backdrop-blur">
              <ShoppingBag className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/15 p-3 backdrop-blur">
            <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-slate-600">
              <Search className="h-4 w-4 text-orange-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search restaurants or food..." className="w-full bg-transparent outline-none" />
            </div>
            <a href="/management.html" target="_blank" rel="noreferrer" className="rounded-2xl bg-slate-900/80 px-4 py-2 text-sm font-semibold">Admin Panel</a>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-white/20 p-3 text-sm backdrop-blur">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>Gandikota • Current location</span>
            </div>
            <div className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{cartItems.reduce((sum, entry) => sum + entry.quantity, 0)} items</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[24px] border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-500">Featured</p>
              <h2 className="text-xl font-bold text-slate-900">Our Stalls</h2>
            </div>
            <div className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-600">{filteredRestaurants.length} restaurants</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4, scale: 1.01 }} key={restaurant.id} onClick={() => openRestaurant(restaurant)} className="overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50 text-left shadow-sm transition hover:border-orange-200 hover:shadow-lg">
                <div className={`h-32 bg-gradient-to-br ${restaurant.color}`}>
                  <img src={restaurant.cover} alt={restaurant.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">{restaurant.logo}</div>
                      <div>
                        <p className="font-semibold text-slate-900">{restaurant.name}</p>
                        <p className="text-sm text-slate-500">{restaurant.cuisine}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${restaurant.status === 'Open' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{restaurant.status}</span>
                  </div>
                  <div className="mb-3 flex items-center gap-3 text-sm text-slate-600">
                    <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-orange-400 text-orange-400" />{restaurant.rating}</span>
                    <span className="flex items-center gap-1"><Clock3 className="h-4 w-4" />{restaurant.time}</span>
                  </div>
                  <p className="mb-3 text-sm text-slate-500">{restaurant.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">{restaurant.type === 'veg' ? '🥗 Veg' : '🍖 Non-Veg'}</span>
                    <ArrowRight className="h-4 w-4 text-orange-500" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-[24px] border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-500">Quick Picks</p>
              <h2 className="text-xl font-bold text-slate-900">Popular dishes</h2>
            </div>
            <Sparkles className="h-5 w-5 text-orange-400" />
          </div>
          <div className="space-y-3">
            {popularItems.map((item) => (
              <div key={`${item.restaurantId}:${item.id}`} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.restaurantName}</p>
                </div>
                <button onClick={() => addToCart(restaurants.find((restaurant) => restaurant.id === item.restaurantId), item)} className="rounded-full bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white">Add</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderMenu = () => {
    if (!selectedRestaurant) return null;
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4 pb-24 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[30px] border border-orange-100 bg-white shadow-[0_20px_60px_rgba(255,107,0,0.12)]">
          <img src={selectedRestaurant.cover} alt={selectedRestaurant.name} className="h-48 w-full object-cover sm:h-64" />
          <div className="p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-orange-500">{selectedRestaurant.cuisine}</p>
                <h2 className="text-2xl font-black text-slate-900">{selectedRestaurant.name}</h2>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">{selectedRestaurant.status}</div>
            </div>
            <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-orange-400 text-orange-400" />{selectedRestaurant.rating}</span>
              <span className="flex items-center gap-1"><Clock3 className="h-4 w-4" />{selectedRestaurant.time}</span>
              <span className="flex items-center gap-1"><UtensilsCrossed className="h-4 w-4" />{selectedRestaurant.type === 'veg' ? 'Pure Veg' : 'Non-Veg'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedRestaurant.categories.map((category) => (
                <span key={category} className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-600">{category}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {selectedRestaurant.items.map((item) => (
            <motion.div layout key={item.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[24px] border border-orange-100 bg-white shadow-sm">
              <img src={item.image} alt={item.name} className="h-40 w-full object-cover" />
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                    <p className="text-sm text-slate-500">{item.description}</p>
                  </div>
                  <div className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600">{item.veg ? 'Veg' : 'Non-Veg'}</div>
                </div>
                <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">₹{item.price}</span>
                  <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-orange-400 text-orange-400" />{item.rating}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                    <button onClick={() => changeQuantity(`${selectedRestaurant.id}:${item.id}`, -1)} className="h-8 w-8 rounded-full text-lg font-semibold text-slate-700">−</button>
                    <span className="w-6 text-center text-sm font-semibold">{(cart[`${selectedRestaurant.id}:${item.id}`]?.quantity || 0)}</span>
                    <button onClick={() => changeQuantity(`${selectedRestaurant.id}:${item.id}`, 1)} className="h-8 w-8 rounded-full text-lg font-semibold text-slate-700">+</button>
                  </div>
                  <button onClick={() => addToCart(selectedRestaurant, item)} className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600">Add</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  };

  const renderCart = () => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4 pb-28 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-orange-500">Unified cart</p>
            <h2 className="text-2xl font-black text-slate-900">Your order</h2>
          </div>
          <div className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-600">{cartItems.reduce((sum, entry) => sum + entry.quantity, 0)} items</div>
        </div>

        {cartItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            Your cart is empty. Start exploring stalls and build a multi-restaurant feast.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedCart).map(([restaurantId, entries]) => {
              const restaurant = restaurants.find((item) => item.id === Number(restaurantId));
              const subtotal = entries.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
              return (
                <div key={restaurantId} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{restaurant?.name}</p>
                      <p className="text-sm text-slate-500">Restaurant-wise grouping</p>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">Subtotal ₹{subtotal}</div>
                  </div>
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div key={entry.itemId} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 shadow-sm">
                        <div>
                          <p className="font-semibold text-slate-800">{entry.itemName}</p>
                          <p className="text-sm text-slate-500">₹{entry.price} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => changeQuantity(`${restaurantId}:${entry.itemId}`, -1)} className="h-7 w-7 rounded-full bg-slate-100 text-lg">−</button>
                          <span className="w-5 text-center text-sm font-semibold">{entry.quantity}</span>
                          <button onClick={() => changeQuantity(`${restaurantId}:${entry.itemId}`, 1)} className="h-7 w-7 rounded-full bg-slate-100 text-lg">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900">Order summary</h3>
          <span className="text-sm text-slate-500">One payment • many restaurants</span>
        </div>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex justify-between"><span>Items</span><span>₹{cartItems.reduce((sum, entry) => sum + entry.price * entry.quantity, 0)}</span></div>
          <div className="flex justify-between"><span>Taxes</span><span>₹45</span></div>
          <div className="flex justify-between"><span>Platform fee</span><span>₹18</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900"><span>Grand total</span><span>₹{grandTotal}</span></div>
        </div>
        {checkoutStage === 'cart' && (
          <button onClick={proceedToCheckout} disabled={cartItems.length === 0} className="mt-5 w-full rounded-full bg-orange-500 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Proceed to checkout</button>
        )}
      </div>

      {checkoutStage === 'checkout' && !orderPlaced && (
        <div className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-500" />
            <h3 className="text-xl font-black text-slate-900">Choose payment</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {paymentMethods.map((method) => (
              <button key={method} onClick={() => setPaymentMethod(method)} className={`rounded-[18px] border px-4 py-3 text-left font-semibold ${paymentMethod === method ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-200 text-slate-700'}`}>
                {method}
              </button>
            ))}
          </div>
          <button onClick={placeOrder} className="mt-5 w-full rounded-full bg-slate-900 px-4 py-3 font-semibold text-white">Pay ₹{grandTotal} via {paymentMethod}</button>
        </div>
      )}

      {orderPlaced && (
        <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-600">Payment Successful</p>
              <h3 className="text-xl font-black text-slate-900">Order confirmed</h3>
            </div>
          </div>
          <p className="mb-4 text-sm text-slate-600">Master Order ID: TTY-2048 • Estimated prep: 25 mins</p>
          <div className="space-y-3">
            {Object.keys(groupedCart).map((restaurantId) => {
              const restaurant = restaurants.find((item) => item.id === Number(restaurantId));
              return (
                <div key={restaurantId} className="rounded-[20px] border border-emerald-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{restaurant?.name}</p>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Preparing</span>
                  </div>
                  <p className="text-sm text-slate-500">Order ID: {restaurant?.name.slice(0, 3).toUpperCase()}-103</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderOrders = () => (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 pb-24 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-orange-500">Recent</p>
            <h2 className="text-2xl font-black text-slate-900">Your orders</h2>
          </div>
          <BellDot className="h-5 w-5 text-orange-500" />
        </div>
        <div className="space-y-3">
          {['Pizza Corner', 'Juice Point', 'Dessert House'].map((name, index) => (
            <div key={name} className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="font-semibold text-slate-900">{name}</p>
                <p className="text-sm text-slate-500">{index === 0 ? 'Preparing' : index === 1 ? 'Delivered' : 'Accepted'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">₹{index === 0 ? 727 : index === 1 ? 99 : 149}</p>
                <p className="text-xs text-slate-500">Order #{index + 104}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 pb-24 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-xl font-black text-white">TF</div>
          <div>
            <p className="text-sm font-semibold text-orange-500">Member since 2024</p>
            <h2 className="text-2xl font-black text-slate-900">Welcome back</h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Favorites', value: '12' },
            { label: 'Offers', value: '4' },
            { label: 'Reviews', value: '18' }
          ].map((stat) => (
            <div key={stat.label} className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-lg font-black text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fffaf6] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-xl font-black text-white">TF</div>
            <div>
              <p className="text-base font-black text-slate-900">TastyFoods</p>
              <p className="text-sm text-slate-500">Food court ordering</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveView('home')} className="rounded-full border border-slate-200 p-2.5 text-slate-600"><LayoutGrid className="h-5 w-5" /></button>
            <button onClick={() => setActiveView('cart')} className="rounded-full border border-slate-200 p-2.5 text-slate-600"><ShoppingBag className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait">
          {activeView === 'home' && renderHome()}
          {activeView === 'menu' && renderMenu()}
          {activeView === 'cart' && renderCart()}
          {activeView === 'orders' && renderOrders()}
          {activeView === 'profile' && renderProfile()}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-orange-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-around px-2 py-2 sm:px-6">
          {[
            { id: 'home', label: 'Home', icon: Home },
            { id: 'menu', label: 'Explore', icon: Search },
            { id: 'cart', label: 'Cart', icon: ShoppingBag },
            { id: 'orders', label: 'Orders', icon: Store },
            { id: 'profile', label: 'Profile', icon: Menu }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveView(item.id)} className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold ${activeView === item.id ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
