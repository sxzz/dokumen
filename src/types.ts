export interface TypeRef {
  start: number
  end: number
  file: string
  text?: string
}

export interface ResolvedType {
  refs?: TypeRef[]
  unionType?: ResolvedType[]
  text: string
}

export interface Prop {
  name: string
  type: ResolvedType
  default: string
  description: string
  required: boolean
}

export interface Emit {
  name: string
  signatures: { name: string; type: ResolvedType }[][]
  description: string
}
