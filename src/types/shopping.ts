export interface ItemCompra {
    nombre: string;
    cantidad: number;
    unidad?: string;
    categoria?: string;
}

export interface PlatoOmitidoCompra {
    dia: string;
    turno: "comida" | "cena";
    nombre: string;
}

export interface ListaCompra {
    generado_en: string;
    planificacion_generada_en?: string;
    total_items: number;
    items: ItemCompra[];
    total_platos_omitidos?: number;
    platos_omitidos?: PlatoOmitidoCompra[];
}
