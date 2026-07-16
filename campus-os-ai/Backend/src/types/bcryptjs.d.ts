declare module 'bcryptjs' {
  const bcrypt: {
    hash(password: string, saltOrRounds: string | number): Promise<string>
    compare(data: string, encrypted: string): Promise<boolean>
  }

  export default bcrypt
}

