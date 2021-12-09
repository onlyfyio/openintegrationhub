interface Type {
  type: string
}

export interface ContactMapping {
  type: string,
  value: {
    dataHubId: Type,
    tenant: Type,
    firstName: Type,
    lastName: Type,
    email: Type
  }
}

export interface ContactValue {
  dataHubId: string,
  tenant: string,
  firstName: string,
  lastName: string,
  email: string
}

export const contactMapping: ContactMapping = {
  type: "contact",
  value: {
    tenant: { type: 'text' },
    dataHubId: { type: 'text' },
    firstName: { type: 'text' },
    lastName: { type: 'text' },
    email: { type: 'text' },
  }
}