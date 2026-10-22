/**
 * Yangon Food Vendors, Restaurants, Tea Shops, Bakeries, and Grocers
 * Curated reference dataset for last-mile food and grocery delivery in Yangon, Myanmar.
 */

export type YangonFoodCategory =
  | "tea_shop"
  | "traditional_curry"
  | "noodles"
  | "bakery_cafe"
  | "biryani_halal"
  | "grocery_produce"
  | "beverages";

export type FoodPackagingType =
  | "thermal_bag"
  | "leakproof_liquid"
  | "bakery_box"
  | "standard_bag"
  | "cold_insulated";

export type DietaryTag = "halal" | "vegetarian" | "vegan" | "spicy";

export type FoodItem = {
  id: string;
  name: string;
  nativeName: string;
  description: string;
  priceMmk: number;
  typicalWeightKg: number;
  isPerishable: boolean;
  requiresThermalBag: boolean;
  isFragile: boolean;
  dietary?: DietaryTag[];
};

export type FoodVendor = {
  id: string;
  name: string;
  nativeName: string;
  category: YangonFoodCategory;
  township: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  rating: number;
  operatingHours: {
    open: string;
    close: string;
  };
  packagingType: FoodPackagingType;
  items: readonly FoodItem[];
};

export const YANGON_FOOD_CATEGORIES: readonly {
  id: YangonFoodCategory;
  label: string;
  burmeseLabel: string;
  icon: string;
}[] = [
  {
    id: "tea_shop",
    label: "Tea Shops & Breakfast",
    burmeseLabel: "လက်ဖက်ရည်ဆိုင်နှင့် မနက်စာ",
    icon: "coffee",
  },
  {
    id: "traditional_curry",
    label: "Burmese Curries & Rice",
    burmeseLabel: "မြန်မာထမင်းဟင်း",
    icon: "utensils",
  },
  {
    id: "noodles",
    label: "Shan & Regional Noodles",
    burmeseLabel: "ရှမ်းနှင့် ဒေသအစားအစာ ခေါက်ဆွဲ",
    icon: "bowl",
  },
  {
    id: "bakery_cafe",
    label: "Bakeries & Cafes",
    burmeseLabel: "ကိတ်နှင့် မုန့်တိုက်",
    icon: "cake",
  },
  {
    id: "biryani_halal",
    label: "Danbauk & Halal",
    burmeseLabel: "ဒံပေါက်နှင့် ဟာလာလ်",
    icon: "drumstick",
  },
  {
    id: "grocery_produce",
    label: "Supermarkets & Groceries",
    burmeseLabel: "ကုန်စုံနှင့် လတ်ဆတ်သီးနှံ",
    icon: "shopping-bag",
  },
  {
    id: "beverages",
    label: "Boba & Cold Drinks",
    burmeseLabel: "ဘိုဘာနှင့် အအေးစုံ",
    icon: "glass",
  },
] as const;

export const YANGON_FOOD_VENDORS: readonly FoodVendor[] = [
  {
    id: "food_vendor_lucky_seven",
    name: "Lucky Seven Tea House",
    nativeName: "လပ်ကီးဆဲဗင်း လက်ဖက်ရည်ဆိုင်",
    category: "tea_shop",
    township: "Sanchaung",
    address: "No. 32, Shin Saw Pu Road, Sanchaung, Yangon",
    latitude: 16.8055,
    longitude: 96.1342,
    phone: "+95 9 421 555 101",
    rating: 4.6,
    operatingHours: { open: "06:00", close: "18:00" },
    packagingType: "thermal_bag",
    items: [
      {
        id: "l7_mohinga_special",
        name: "Mohinga Special with Duck Egg & Crispy Fritters",
        nativeName: "မုန့်ဟင်းခါး အထူး (ဘဲဥနှင့်ပဲကြော်)",
        description:
          "Classic Yangon fish broth mohinga with crispy yellow pea fritters and sliced duck egg.",
        priceMmk: 3500,
        typicalWeightKg: 0.6,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "l7_nan_gyi_thoke",
        name: "Nan Gyi Thoke (Warm Chicken Noodle Salad)",
        nativeName: "နန်းကြီးသုပ်",
        description:
          "Thick round rice noodles tossed with spiced chicken gravy, toasted chickpea flour, and fresh shallots.",
        priceMmk: 3800,
        typicalWeightKg: 0.5,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: false,
      },
      {
        id: "l7_pauksi_pork",
        name: "Steamed Pork Pauksi (2 pcs)",
        nativeName: "ဝက်သားပေါက်စီ ၂ လုံး",
        description:
          "Fluffy steamed Chinese-style buns stuffed with savory spiced pork filling.",
        priceMmk: 2400,
        typicalWeightKg: 0.4,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "l7_tea_cho_kya",
        name: "Cho Kya Traditional Milk Tea (Hot)",
        nativeName: "ချိုကျ လက်ဖက်ရည်",
        description:
          "Rich, aromatic Myanmar tea brewed strong and sweetened with evaporated and condensed milk.",
        priceMmk: 1800,
        typicalWeightKg: 0.3,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: true,
      },
    ],
  },
  {
    id: "food_vendor_rangoon_tea_house",
    name: "Rangoon Tea House",
    nativeName: "ရန်ကုန်တီးဟောက်စ်",
    category: "tea_shop",
    township: "Kyauktada",
    address: "Ground Floor, 77-79 Pansodan Street, Kyauktada, Yangon",
    latitude: 16.7745,
    longitude: 96.162,
    phone: "+95 9 979 078 830",
    rating: 4.7,
    operatingHours: { open: "07:00", close: "22:00" },
    packagingType: "thermal_bag",
    items: [
      {
        id: "rth_mohinga",
        name: "Signature Mohinga with River Catfish",
        nativeName: "အထူးငါးခူမုန့်ဟင်းခါး",
        description:
          "Artisan river catfish broth slow-cooked with lemongrass, ginger, toasted rice flour, and crispy gourd fritters.",
        priceMmk: 6500,
        typicalWeightKg: 0.7,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "rth_samusa_soup",
        name: "Crispy Samusa Thoke Soup",
        nativeName: "စမူဆာဟင်းချို",
        description:
          "Golden fried potato samosas cut into a rich tamarind and spiced chickpea broth with shredded cabbage.",
        priceMmk: 5200,
        typicalWeightKg: 0.6,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
        dietary: ["vegetarian"],
      },
      {
        id: "rth_mutton_paratha",
        name: "Tender Mutton Keema Paratha Set",
        nativeName: "ဆိတ်သားပလာတာတွဲ",
        description:
          "Slow-braised minced mutton cooked with fragrant spices served with flaky pan-fried parathas.",
        priceMmk: 8500,
        typicalWeightKg: 0.6,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
        dietary: ["halal"],
      },
      {
        id: "rth_golden_chai",
        name: "Golden Chai Spiced Tea",
        nativeName: "ရွှေလက်ဖက်ရည်",
        description: "Cardamom and star anise infused milk tea.",
        priceMmk: 3500,
        typicalWeightKg: 0.35,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: true,
      },
    ],
  },
  {
    id: "food_vendor_999_shan",
    name: "999 Shan Noodle House",
    nativeName: "၉၉၉ ရှမ်းခေါက်ဆွဲဆိုင်",
    category: "noodles",
    township: "Kyauktada",
    address: "No. 130 34th Street, Kyauktada, Yangon",
    latitude: 16.7768,
    longitude: 96.1602,
    phone: "+95 1 383 795",
    rating: 4.5,
    operatingHours: { open: "06:00", close: "19:00" },
    packagingType: "leakproof_liquid",
    items: [
      {
        id: "shan999_sticky_chicken",
        name: "Sticky Shan Khauk Swé with Minced Chicken",
        nativeName: "ရှမ်းခေါက်ဆွဲစေး (ကြက်သား)",
        description:
          "Chewy Shan rice noodles coated in fragrant tomato-chicken sauce with crushed peanuts and scallions.",
        priceMmk: 4200,
        typicalWeightKg: 0.5,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "shan999_soup_noodle",
        name: "Shan Noodle Clear Soup (Pork Ribs)",
        nativeName: "ရှမ်းခေါက်ဆွဲအရည် (ဝက်နံရိုး)",
        description:
          "Rice noodles served in a savory simmering pork broth with pickled mustard greens and chili oil.",
        priceMmk: 4800,
        typicalWeightKg: 0.65,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "shan999_dumplings",
        name: "Steamed Shan Dumplings (6 pcs)",
        nativeName: "ဖက်ထုပ်ပေါင်း ၆ လုံး",
        description:
          "Handmade steamed pork and scallion dumplings served with spicy garlic sesame dip.",
        priceMmk: 4500,
        typicalWeightKg: 0.35,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "shan999_fried_tofu",
        name: "Crispy Fried Shan Chickpea Tofu",
        nativeName: "ရှမ်းတိုဟူးကြော်",
        description:
          "Fresh Shan yellow tofu deep fried until golden crispy outside and silky smooth inside.",
        priceMmk: 3000,
        typicalWeightKg: 0.3,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: false,
        dietary: ["vegetarian", "vegan"],
      },
    ],
  },
  {
    id: "food_vendor_feel_myanmar",
    name: "Feel Myanmar Food",
    nativeName: "ဖီးလ် မြန်မာ့အစားအစာ",
    category: "traditional_curry",
    township: "Dagon",
    address: "No. 124 Pyidaungsu Yeiktha Street, Dagon, Yangon",
    latitude: 16.7876,
    longitude: 96.1481,
    phone: "+95 9 730 498 64",
    rating: 4.4,
    operatingHours: { open: "06:00", close: "20:30" },
    packagingType: "thermal_bag",
    items: [
      {
        id: "feel_mutton_curry_set",
        name: "Braised Mutton Curry Set with Rice & Soup",
        nativeName: "ဆိတ်သားဟင်းနှင့် ထမင်းတွဲ",
        description:
          "Tender Burmese mutton curry slow-braised with sweet onions, accompanied by steamed rice and sour leaf soup.",
        priceMmk: 14000,
        typicalWeightKg: 0.85,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "feel_prawn_curry",
        name: "Freshwater Giant Prawn Curry (Puzun Si Pyan)",
        nativeName: "ပုစွန်ထုပ်ဆီပြန်ဟင်း",
        description:
          "Large river prawns cooked in savory spiced oil with garlic, ginger, and turmeric.",
        priceMmk: 18000,
        typicalWeightKg: 0.7,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "feel_fish_cake_curry",
        name: "Burmese Featherback Fish Cake Curry",
        nativeName: "ငါးဖယ်ဆီပြန်ဟင်း",
        description:
          "Springy hand-beaten featherback fish cakes simmering in a rich tomato and shallot gravy.",
        priceMmk: 8500,
        typicalWeightKg: 0.6,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "feel_ngapi_platter",
        name: "Ngapi Yay & Fresh Seasonal Dip Platter",
        nativeName: "ငါးပိရည်တို့စရာစုံ",
        description:
          "Spicy fermented fish dip served with steamed vegetables, baby eggplants, and fresh cucumber slices.",
        priceMmk: 4000,
        typicalWeightKg: 0.5,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: false,
        dietary: ["spicy"],
      },
    ],
  },
  {
    id: "food_vendor_aung_mingalar",
    name: "Aung Mingalar Shan Noodle Restaurant",
    nativeName: "အောင်မင်္ဂလာ ရှမ်းခေါက်ဆွဲ",
    category: "noodles",
    township: "Dagon",
    address: "Corner of Nawaday St and Bo Yar Nyunt St, Dagon, Yangon",
    latitude: 16.7839,
    longitude: 96.1521,
    phone: "+95 9 514 0620",
    rating: 4.6,
    operatingHours: { open: "07:00", close: "21:00" },
    packagingType: "leakproof_liquid",
    items: [
      {
        id: "am_tofu_nway",
        name: "Tofu Nway (Warm Shan Tofu Rice Noodles)",
        nativeName: "တိုဟူးနွေး ခေါက်ဆွဲ",
        description:
          "Creamy warm yellow chickpea porridge poured over thin rice noodles with garlic chili oil and toasted sesame.",
        priceMmk: 4500,
        typicalWeightKg: 0.65,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
        dietary: ["vegetarian"],
      },
      {
        id: "am_mandalay_meeshay",
        name: "Mandalay Meeshay with Roasted Garlic Sauce",
        nativeName: "မန္တလေးမြီးရှည်",
        description:
          "Thick rice noodles dressed with rich braised meat gravy, bean paste sauce, and crispy shallots.",
        priceMmk: 4800,
        typicalWeightKg: 0.55,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: false,
      },
      {
        id: "am_ribs_soup",
        name: "Shan Rice Noodle Soup with Braised Pork Ribs",
        nativeName: "ဝက်နံရိုး ရှမ်းခေါက်ဆွဲအရည်",
        description:
          "Hearty broth with fall-off-the-bone tender ribs and rice noodles.",
        priceMmk: 5500,
        typicalWeightKg: 0.7,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
    ],
  },
  {
    id: "food_vendor_maung_aye",
    name: "Maung Aye Mohinga",
    nativeName: "မောင်အေး မုန့်ဟင်းခါး",
    category: "tea_shop",
    township: "Bahan",
    address: "Sayar San Road, near Pearl Condo, Bahan, Yangon",
    latitude: 16.821,
    longitude: 96.1585,
    phone: "+95 9 420 119 044",
    rating: 4.8,
    operatingHours: { open: "06:00", close: "13:00" },
    packagingType: "leakproof_liquid",
    items: [
      {
        id: "ma_classic_mohinga",
        name: "Classic Yangon Fish Broth Mohinga Set",
        nativeName: "ရိုးရာငါးမုန့်ဟင်းခါး အထူးပွဲ",
        description:
          "Authentic hearty fish soup with banana stem slices, thin rice vermicelli, and boiled duck egg.",
        priceMmk: 3800,
        typicalWeightKg: 0.65,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "ma_pea_fritters",
        name: "Crispy Yellow Split Pea Fritters Pack (5 pcs)",
        nativeName: "ပဲကြော်ပွဲ ၅ ခု",
        description:
          "Freshly fried crunchy split-pea crackers seasoned with sea salt.",
        priceMmk: 2000,
        typicalWeightKg: 0.25,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
        dietary: ["vegetarian", "vegan"],
      },
    ],
  },
  {
    id: "food_vendor_shwe_pu_zun",
    name: "Shwe Pu Zun Bakery & Cafeteria",
    nativeName: "ရွှေပုဇွန် ကိတ်နှင့်မုန့်တိုက်",
    category: "bakery_cafe",
    township: "Pazundaung",
    address: "No. 246/248 Anawrahta Road, Pazundaung, Yangon",
    latitude: 16.7812,
    longitude: 96.1724,
    phone: "+95 1 296 571",
    rating: 4.7,
    operatingHours: { open: "07:00", close: "19:30" },
    packagingType: "bakery_box",
    items: [
      {
        id: "spz_royal_falooda",
        name: "Signature Yangon Royal Falooda (Cold Pack)",
        nativeName: "ရွှေပုဇွန် ဖာလူဒါ အထူး",
        description:
          "Chilled rose milk layered with egg pudding, basil seeds, red agar jelly, and rich vanilla ice cream.",
        priceMmk: 4500,
        typicalWeightKg: 0.55,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
      {
        id: "spz_butter_cake",
        name: "Strawberry Butter Sponge Cake (1 lb)",
        nativeName: "စတော်ဘယ်ရီ ထောပတ်ကိတ် (၁ ပေါင်)",
        description:
          "Velvety butter sponge cake layered with strawberry preserves and fresh butter cream.",
        priceMmk: 16000,
        typicalWeightKg: 0.95,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
      {
        id: "spz_cream_horns",
        name: "Crispy Cream Horns Box (4 pcs)",
        nativeName: "ခရင်မ်ဟွန်း မုန့်ဘူး ၄ ခု",
        description:
          "Flaky puff pastry horns filled to order with sweet whipped vanilla cream.",
        priceMmk: 5600,
        typicalWeightKg: 0.4,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
      {
        id: "spz_egg_pudding",
        name: "Traditional Steamed Egg Pudding Tub",
        nativeName: "ဥပူတင်းဗူး",
        description:
          "Smooth caramelized egg custard prepared with farm fresh milk.",
        priceMmk: 3800,
        typicalWeightKg: 0.35,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
    ],
  },
  {
    id: "food_vendor_sp_bakery",
    name: "SP Bakery & Confectionery",
    nativeName: "အက်စ်ပီ ကိတ်မုန့်တိုက်",
    category: "bakery_cafe",
    township: "Bahan",
    address: "Kaba Aye Pagoda Road, near Pearl Center, Bahan, Yangon",
    latitude: 16.8285,
    longitude: 96.1594,
    phone: "+95 9 785 112 001",
    rating: 4.5,
    operatingHours: { open: "07:30", close: "20:00" },
    packagingType: "bakery_box",
    items: [
      {
        id: "sp_birthday_cake",
        name: "Fresh Fruit Birthday Cream Cake (1.5 lb)",
        nativeName: "လတ်ဆတ်သစ်သီးမွေးနေ့ကိတ် (၁.၅ ပေါင်)",
        description:
          "Delicate sponge cake topped with fresh kiwi, strawberries, and oranges. Handle with extra care.",
        priceMmk: 28000,
        typicalWeightKg: 1.25,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
      {
        id: "sp_pandan_chiffon",
        name: "Pandan Chiffon Loaf",
        nativeName: "ပန်ဒန် ဂျပန်ပေါင်မုန့်",
        description:
          "Light-as-air chiffon loaf naturally scented with fresh pandan leaf extract.",
        priceMmk: 4800,
        typicalWeightKg: 0.45,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: false,
      },
      {
        id: "sp_chicken_curry_puffs",
        name: "Golden Chicken Curry Puffs (4 pcs)",
        nativeName: "ကြက်သားကာရီပတ်ဖ် ၄ ခု",
        description:
          "Spiral puff pastries filled with curried chicken and diced potatoes.",
        priceMmk: 6000,
        typicalWeightKg: 0.5,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
    ],
  },
  {
    id: "food_vendor_nilar_biryani",
    name: "Nilar Biryani & Halal Restaurant",
    nativeName: "နီလာ ဒံပေါက်",
    category: "biryani_halal",
    township: "Kyauktada",
    address: "No. 216 Anawrahta Road, Kyauktada, Yangon",
    latitude: 16.7772,
    longitude: 96.1578,
    phone: "+95 1 245 423",
    rating: 4.3,
    operatingHours: { open: "08:00", close: "21:00" },
    packagingType: "thermal_bag",
    items: [
      {
        id: "nilar_chicken_danbauk",
        name: "Chicken Danbauk Spiced Biryani Box",
        nativeName: "ကြက်သားဒံပေါက်ဗူး",
        description:
          "Fragrant saffron basmati rice with whole chicken leg, cashew nuts, raisins, cucumber mint raita, and sour mango pickle.",
        priceMmk: 8500,
        typicalWeightKg: 0.75,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
        dietary: ["halal"],
      },
      {
        id: "nilar_mutton_biryani",
        name: "Mutton Dum Biryani with Spiced Basmati",
        nativeName: "ဆိတ်သားဒံပေါက် အထူးပွဲ",
        description:
          "Tender bone-in mutton slow steamed with aged basmati rice and house spice blend.",
        priceMmk: 14500,
        typicalWeightKg: 0.8,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
        dietary: ["halal"],
      },
    ],
  },
  {
    id: "food_vendor_kyet_shar_soon",
    name: "Kyet Shar Soon Biryani",
    nativeName: "ကြက်ရှာစွန်း ဒံပေါက်",
    category: "biryani_halal",
    township: "Pabedan",
    address: "No. 42 28th Street, Pabedan, Yangon",
    latitude: 16.776,
    longitude: 96.1545,
    phone: "+95 9 501 2284",
    rating: 4.4,
    operatingHours: { open: "08:30", close: "20:00" },
    packagingType: "thermal_bag",
    items: [
      {
        id: "kss_dum_biryani",
        name: "Special Dum Biryani Chicken Set",
        nativeName: "အထူးကြက်ဒံပေါက် အစုံတွဲ",
        description:
          "Slow-baked Yangon-style dum biryani with marinated whole chicken thigh, golden shallots, and spicy clear soup.",
        priceMmk: 9000,
        typicalWeightKg: 0.8,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
        dietary: ["halal"],
      },
      {
        id: "kss_samosa_pack",
        name: "Chicken Samosa Pack (4 pcs)",
        nativeName: "ကြက်သားစမူဆာ ၄ ခု",
        description:
          "Deep fried crisp triangles filled with minced chicken and green coriander.",
        priceMmk: 3600,
        typicalWeightKg: 0.35,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
        dietary: ["halal"],
      },
    ],
  },
  {
    id: "food_vendor_min_lan",
    name: "Min Lan Seafood & Rakhine Mont Di",
    nativeName: "မင်းလမ်း ရခိုင်မုန့်တီ",
    category: "traditional_curry",
    township: "South Okkalapa",
    address: "Waizayandar Road, South Okkalapa, Yangon",
    latitude: 16.848,
    longitude: 96.196,
    phone: "+95 9 795 558 811",
    rating: 4.6,
    operatingHours: { open: "09:00", close: "21:30" },
    packagingType: "leakproof_liquid",
    items: [
      {
        id: "ml_rakhine_mont_di",
        name: "Spicy Rakhine Mont Di Clear Fish Soup",
        nativeName: "ရခိုင်မုန့်တီစပ်စပ်အရည်",
        description:
          "Pungent coastal fish soup seasoned with fiery Rakhine green chilies, ngapi, and rice vermicelli.",
        priceMmk: 5000,
        typicalWeightKg: 0.7,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
        dietary: ["spicy"],
      },
      {
        id: "ml_grilled_prawns",
        name: "Grilled Butter Tiger Prawns",
        nativeName: "ကျားပုစွန်ထောပတ်ကင်",
        description:
          "Fresh coastal prawns grilled over charcoal with garlic butter sauce.",
        priceMmk: 22000,
        typicalWeightKg: 0.6,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
    ],
  },
  {
    id: "food_vendor_danuphyu",
    name: "Danuphyu Daw Saw Yee",
    nativeName: "ဓနုဖြူဒေါ်စောရီ မြန်မာထမင်းဆိုင်",
    category: "traditional_curry",
    township: "Pabedan",
    address: "No. 175 29th Street, Pabedan, Yangon",
    latitude: 16.777,
    longitude: 96.1538,
    phone: "+95 1 371 498",
    rating: 4.5,
    operatingHours: { open: "09:00", close: "20:00" },
    packagingType: "thermal_bag",
    items: [
      {
        id: "danuphyu_fish_head",
        name: "Traditional Freshwater Fish Head Curry",
        nativeName: "ငါးသိုင်းခေါင်းဆီပြန်ဟင်း",
        description:
          "Classic Danuphyu-style freshwater fish head cooked tender in aromatic oil.",
        priceMmk: 12000,
        typicalWeightKg: 0.9,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
      {
        id: "danuphyu_pork_mango",
        name: "Braised Pork Curry with Green Mango Pickle",
        nativeName: "ဝက်သားသရက်သီးသနပ်ဟင်း",
        description:
          "Pork belly cubes stewed with tangy pickled green mangoes and garlic cloves.",
        priceMmk: 9500,
        typicalWeightKg: 0.65,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
    ],
  },
  {
    id: "food_vendor_city_mart_myaynigone",
    name: "City Mart Supermarket - Myaynigone",
    nativeName: "စီးတီးမတ် ကုန်စုံစတိုး (မြေနီကုန်း)",
    category: "grocery_produce",
    township: "Sanchaung",
    address:
      "Corner of Shin Saw Pu Rd & Pyay Rd, Myaynigone, Sanchaung, Yangon",
    latitude: 16.8078,
    longitude: 96.1362,
    phone: "+95 1 523 840",
    rating: 4.5,
    operatingHours: { open: "08:00", close: "21:00" },
    packagingType: "standard_bag",
    items: [
      {
        id: "cm_milk_eggs",
        name: "Fresh Whole Milk 1L & Free-Range Farm Eggs Pack (10 pcs)",
        nativeName: "လတ်ဆတ်နို့ရည် ၁ လီတာနှင့် ကြက်ဥကတ် (၁၀ လုံး)",
        description:
          "Chilled dairy fresh pasteurized milk and farm eggs carton.",
        priceMmk: 7800,
        typicalWeightKg: 1.6,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
      {
        id: "cm_cooking_oil_rice",
        name: "Daily Pantry Essentials: Sunflower Oil (1L) & Shwebo Jasmine Rice (5kg)",
        nativeName: "နေကြာဆီ ၁ လီတာနှင့် ရွှေဘိုပေါ်ဆန်းမွှေးဆန် ၅ ကီလို",
        description:
          "Household cooking essentials bundle in sturdy carry sack.",
        priceMmk: 34000,
        typicalWeightKg: 6.0,
        isPerishable: false,
        requiresThermalBag: false,
        isFragile: false,
      },
      {
        id: "cm_shan_vegetables",
        name: "Shan Highlands Fresh Vegetable Crate",
        nativeName: "ရှမ်းပြည်နယ် လတ်ဆတ်သီးနှံစုံခြင်း",
        description:
          "Crisp cabbage, Shan tomatoes, baby carrots, potatoes, and fresh coriander.",
        priceMmk: 12500,
        typicalWeightKg: 2.5,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: false,
        dietary: ["vegetarian", "vegan"],
      },
    ],
  },
  {
    id: "food_vendor_marketplace_bahan",
    name: "Marketplace by City Mart - Golden Valley",
    nativeName: "မာကတ်ပလေ့စ် (ရွှေတောင်ကြား)",
    category: "grocery_produce",
    township: "Bahan",
    address: "No. 40 Dhammazedi Road, Golden Valley, Bahan, Yangon",
    latitude: 16.8145,
    longitude: 96.1485,
    phone: "+95 1 523 888",
    rating: 4.7,
    operatingHours: { open: "08:30", close: "21:00" },
    packagingType: "cold_insulated",
    items: [
      {
        id: "mp_fruit_basket",
        name: "Imported Fresh Fruit Gift Basket",
        nativeName: "တင်သွင်းလတ်ဆတ်သစ်သီး လက်ဆောင်ခြင်း",
        description:
          "Washington red apples, seedless Australian grapes, and sweet oranges in protective wooden basket.",
        priceMmk: 45000,
        typicalWeightKg: 3.2,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
      {
        id: "mp_cheese_charcuterie",
        name: "Artisan Cheese & Cold Cut Deli Selection",
        nativeName: "ဒိန်ခဲနှင့် အသားလွှာစုံ သေတ္တာ",
        description:
          "Aged Dutch gouda, French brie, and sliced roasted turkey breast in chilled vacuum box.",
        priceMmk: 26500,
        typicalWeightKg: 0.8,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: false,
      },
    ],
  },
  {
    id: "food_vendor_cha_tra_mue",
    name: "Cha Tra Mue & Gong cha Tea Bar",
    nativeName: "လက်ဖက်ရည်နှင့် ဘိုဘာအအေးဆိုင်",
    category: "beverages",
    township: "Pabedan",
    address: "Junction City Level 3, Bogyoke Aung San Road, Pabedan, Yangon",
    latitude: 16.7794,
    longitude: 96.1528,
    phone: "+95 9 765 443 210",
    rating: 4.6,
    operatingHours: { open: "09:30", close: "20:30" },
    packagingType: "cold_insulated",
    items: [
      {
        id: "ctm_thai_green_tea",
        name: "Iced Thai Green Milk Tea (2-Cup Carrier)",
        nativeName: "ထိုင်းလက်ဖက်စိမ်းနို့အေး ၂ ခွက်တွဲ",
        description:
          "Fragrant Thai jasmine green tea with creamy sweet milk over crushed ice in spill-resistant cup carrier.",
        priceMmk: 9600,
        typicalWeightKg: 0.8,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
      {
        id: "ctm_boba_milk_tea",
        name: "Brown Sugar Pearl Fresh Milk Tea",
        nativeName: "ဘရောင်းရှူးဂါးဘိုဘာနို့အေး",
        description:
          "Warm brown sugar tapioca pearls with cold fresh milk and cream cap.",
        priceMmk: 6200,
        typicalWeightKg: 0.5,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
    ],
  },
  {
    id: "food_vendor_easy_cafe",
    name: "Easy Cafe & Specialty Coffee",
    nativeName: "အီးဇီး ကဖေးနှင့် အထူးကော်ဖီ",
    category: "bakery_cafe",
    township: "Dagon",
    address: "No. 30 Bo Yar Nyunt Street, Dagon, Yangon",
    latitude: 16.7848,
    longitude: 96.1518,
    phone: "+95 9 254 319 319",
    rating: 4.6,
    operatingHours: { open: "07:30", close: "18:30" },
    packagingType: "bakery_box",
    items: [
      {
        id: "easy_cold_brew",
        name: "Shan Arabica Cold Brew Coffee (Glass Bottle)",
        nativeName: "ရှမ်းအာရေဘီကာ ကော်ဖီအေးဖန်ပုလင်း",
        description:
          "Single-origin Shan State Arabica beans steeped for 18 hours. Sealed glass bottle.",
        priceMmk: 5800,
        typicalWeightKg: 0.45,
        isPerishable: true,
        requiresThermalBag: false,
        isFragile: true,
      },
      {
        id: "easy_sourdough_toast",
        name: "Avocado & Smoked Chicken Sourdough Sandwich",
        nativeName: "ထောပတ်သီးနှင့် ကြက်သားပေါင်မုန့်ညှပ်",
        description:
          "Artisan sourdough toast with ripe avocado, smoked chicken breast, and honey mustard.",
        priceMmk: 9500,
        typicalWeightKg: 0.4,
        isPerishable: true,
        requiresThermalBag: true,
        isFragile: false,
      },
    ],
  },
] as const;

/** Flat list of all available food items across vendors */
export const YANGON_FOOD_ITEMS: readonly (FoodItem & {
  vendorId: string;
  vendorName: string;
})[] = YANGON_FOOD_VENDORS.flatMap((vendor) =>
  vendor.items.map((item) => ({
    ...item,
    vendorId: vendor.id,
    vendorName: vendor.name,
  })),
);

/** Search vendors by name, township, or menu item */
export function searchFoodVendors(query: string): FoodVendor[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...YANGON_FOOD_VENDORS];
  return YANGON_FOOD_VENDORS.filter(
    (vendor) =>
      vendor.name.toLowerCase().includes(q) ||
      vendor.nativeName.toLowerCase().includes(q) ||
      vendor.township.toLowerCase().includes(q) ||
      vendor.address.toLowerCase().includes(q) ||
      vendor.items.some(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.nativeName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q),
      ),
  );
}

/** Filter vendors by township */
export function getFoodVendorsByTownship(township: string): FoodVendor[] {
  const t = township.trim().toLowerCase();
  return YANGON_FOOD_VENDORS.filter(
    (vendor) => vendor.township.toLowerCase() === t,
  );
}

/** Filter vendors by category */
export function getFoodVendorsByCategory(
  category: YangonFoodCategory,
): FoodVendor[] {
  return YANGON_FOOD_VENDORS.filter((vendor) => vendor.category === category);
}

/** Find a specific food item by ID */
export function getFoodItemById(
  itemId: string,
): (FoodItem & { vendor: FoodVendor }) | null {
  for (const vendor of YANGON_FOOD_VENDORS) {
    const found = vendor.items.find((item) => item.id === itemId);
    if (found) {
      return { ...found, vendor };
    }
  }
  return null;
}

/**
 * Builds a standardized parcel_description for food delivery compatible with
 * dispatch parsing (`parseParcelDescription`) and driver delivery instructions.
 */
export function buildFoodParcelDescription(options: {
  vendorName: string;
  itemSummary: string;
  size?: "small" | "medium" | "large";
  fragile?: boolean;
  requiresThermalBag?: boolean;
  schedule?: {
    day: "today" | "tomorrow";
    window: "morning" | "afternoon" | "evening";
  };
}): string {
  const size = options.size ?? "small";
  const fragile = options.fragile ? ", fragile" : "";
  const parts: string[] = [`Food, ${size} size${fragile}`];

  const thermal = options.requiresThermalBag ? " (thermal bag required)" : "";
  parts.push(`${options.vendorName} · ${options.itemSummary}${thermal}`);

  if (options.schedule) {
    parts.push(`Pickup ${options.schedule.day}, ${options.schedule.window}`);
  }

  return parts.join(" · ");
}
