export const channels = [
  {
    id: "ebay",
    name: "eBay",
    description: "Gérer les annonces et la synchronisation du catalogue eBay.",
    href: "/ebay",
    profileUrl: "https://www.ebay.fr/sh/ovw",
    authorizationHost: "auth.ebay.com",
    icon: "package_2",
    tint: "bg-[#FFF394]"
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Connecter le compte Facebook de Daisy Brocante.",
    href: "/facebook",
    profileUrl: "https://www.facebook.com/dbrocante",
    authorizationHost: "www.facebook.com",
    icon: "storefront",
    tint: "bg-[#BFD7FE]"
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Connecter le compte Instagram de Daisy Brocante.",
    href: "/instagram",
    profileUrl: "https://www.instagram.com/daisybrocante/",
    authorizationHost: "www.instagram.com",
    icon: "photo_camera",
    tint: "bg-[#FFAEC1]"
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Connecter le compte TikTok de Daisy Brocante.",
    href: "/tiktok",
    profileUrl: "https://www.tiktok.com/@daisybrocante",
    authorizationHost: "www.tiktok.com",
    icon: "videocam",
    tint: "bg-[#86E2D5]"
  },
  {
    id: "pinterest",
    name: "Pinterest",
    description: "Connecter le compte Pinterest de Daisy Brocante.",
    href: "/pinterest",
    profileUrl: "https://www.pinterest.com/daisybrocante/",
    authorizationHost: "www.pinterest.com",
    icon: "push_pin",
    tint: "bg-[#FFD2A6]"
  }
] as const;

export type Channel = typeof channels[number];
export type ChannelID = Channel["id"];
