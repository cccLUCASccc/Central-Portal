export interface Image {
    id: number;
    url: string;
    position?: number;
}

export interface Pagination {
    total_items: number;
    total_pages: number;
    current_page: number;
    page_size: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: Pagination;
}

export interface Subcategory {
    id: number;
    name: string;
    category: string;
}

export interface Antiquite {
    id: number; 
    name: string;
    description: string;
    images: Image[];
    price : number;
    nouveaute ?: boolean;
    year : number;
    category: string;
    tags ?: string;
    status : number;
    size: string;
    images_urls ?: string;
    ebay_title?: string;
    ebay_description?: string;
    ebay_price?: number;
    ebay_category_id?: string;
    ebay_listing_id?: string;
    ebay_status?: string;
    prev_id?: number;
    next_id?: number;
    subcategory_id?: number;
    subcategory?: Subcategory;
}

export interface Livraison {
    id?: number;
    providername: string;
    pricesmall: number | null;
    pricemedium: number | null;
    pricelarge: number | null;
    pricextralarge: number | null;
}