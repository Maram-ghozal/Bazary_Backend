
const PACKAGES = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    type: "ONLINE",
    maxBrandCapacity: 20,
    topSearch: false,
    aiAssistant: false,
    price: 2000, 
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    type: "HYBRID",
    maxBrandCapacity: 50,
    topSearch: false,
    aiAssistant: true,
    price: 4000, 
  },
  PREMIUM: {
    id: "PREMIUM",
    name: "Premium",
    type: "HYBRID",
    maxBrandCapacity: 100,
    topSearch: true,
    aiAssistant: true,
    price: 6000, 
  },
};

const getPackage = (packageId) => PACKAGES[packageId] || null;

const getAllPackages = () => Object.values(PACKAGES);

module.exports = { PACKAGES, getPackage, getAllPackages };