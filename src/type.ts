export interface Image {
    id: number;
    url: string;
}

export interface Item {
    id?: number; 
    name: string;
    description: string;
    images: Image[];
    status: number;
    price ?: number;
    sold ?: boolean;
}

export interface Vehicule {
    id: number; 
    model: string;
    description: string;
    images: Image[];
    price : number;
    sold ?: boolean;
    year : number;
    status : number
}