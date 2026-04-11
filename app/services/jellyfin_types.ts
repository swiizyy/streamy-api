export interface JellyfinUserPolicy {
  IsAdministrator: boolean
  IsDisabled: boolean
  EnableAllFolders: boolean
}

export interface JellyfinUser {
  Id: string
  Name: string
  PrimaryImageTag?: string
  HasPassword: boolean
  HasConfiguredPassword: boolean
  LastLoginDate?: string
  LastActivityDate?: string
  Configuration?: {
    AudioLanguagePreference?: string
    SubtitleLanguagePreference?: string
  }
  Policy: JellyfinUserPolicy
}

export interface JellyfinAuthResponse {
  User: JellyfinUser
  AccessToken: string
  ServerId: string
}
