import { UserSchema } from '#database/schema'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

export type UserRole = 'admin' | 'user' | 'requester'

export default class User extends UserSchema {
  static accessTokens = DbAccessTokensProvider.forModel(User)
  declare currentAccessToken?: AccessToken

  // Narrows the generated `role: string` to a typed enum
  declare role: UserRole
}
