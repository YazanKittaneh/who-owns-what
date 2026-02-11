import { JustfixUser } from "state-machine";
import { District } from "./APIDataTypes";

export enum ResetStatusCode {
  Accepted = "accepted",
  Expired = "expired",
  Invalid = "invalid",
  Unknown = "unknown",
  Success = "success",
}

export type AuthUserResponse = {
  user?: JustfixUser;
  error?: string;
  error_description?: string;
};

export type ResetStatusResponse = {
  statusCode: ResetStatusCode;
};

const AuthClient = {
  fetchUser: async (): Promise<JustfixUser | undefined> => undefined,
  register: async (
    _username: string,
    _password: string,
    _userType: string,
    _phoneNumber?: string
  ): Promise<AuthUserResponse> => ({
    error: "not_implemented",
    error_description: "Auth is disabled in the Chicago MVP.",
  }),
  login: async (_username: string, _password: string): Promise<AuthUserResponse> => ({
    error: "not_implemented",
    error_description: "Auth is disabled in the Chicago MVP.",
  }),
  logout: async (): Promise<void> => {},
  subscribeBuilding: async (
    _pinOrBbl: string,
    _housenumber: string,
    _streetname: string,
    _zip: string,
    _boro: string
  ): Promise<{ building_subscriptions: JustfixUser["buildingSubscriptions"] }> => ({
    building_subscriptions: [],
  }),
  unsubscribeBuilding: async (
    _pinOrBbl: string
  ): Promise<{ building_subscriptions: JustfixUser["buildingSubscriptions"] }> => ({
    building_subscriptions: [],
  }),
  unsubscribeAllBuilding: async (): Promise<{
    building_subscriptions: JustfixUser["buildingSubscriptions"];
  }> => ({
    building_subscriptions: [],
  }),
  emailUnsubscribeBuilding: async (): Promise<{
    building_subscriptions: JustfixUser["buildingSubscriptions"];
  }> => ({
    building_subscriptions: [],
  }),
  subscribeDistrict: async (
    _district: District
  ): Promise<{ district_subscriptions: JustfixUser["districtSubscriptions"] }> => ({
    district_subscriptions: [],
  }),
  unsubscribeDistrict: async (
    _subscriptionId: string
  ): Promise<{ district_subscriptions: JustfixUser["districtSubscriptions"] }> => ({
    district_subscriptions: [],
  }),
  unsubscribeAllDistrict: async (): Promise<{
    district_subscriptions: JustfixUser["districtSubscriptions"];
  }> => ({
    district_subscriptions: [],
  }),
  emailUnsubscribeDistrict: async (): Promise<{
    district_subscriptions: JustfixUser["districtSubscriptions"];
  }> => ({
    district_subscriptions: [],
  }),
  emailUnsubscribeAllDistrict: async (): Promise<{
    district_subscriptions: JustfixUser["districtSubscriptions"];
  }> => ({
    district_subscriptions: [],
  }),
  updateEmail: async (_email: string): Promise<{ email: string }> => ({ email: "" }),
  updatePassword: async (_currentPassword: string, _newPassword: string): Promise<void> => {},
  isEmailAlreadyUsed: async (_email: string): Promise<boolean> => false,
  resendVerifyEmail: async (): Promise<void> => {},
  requestPasswordReset: async (_email?: string): Promise<boolean> => true,
  resetPasswordRequest: async (_email?: string): Promise<boolean> => true,
  resetPasswordCheck: async (): Promise<ResetStatusResponse> => ({
    statusCode: ResetStatusCode.Invalid,
  }),
  resetPassword: async (_token: string, _newPassword: string): Promise<ResetStatusResponse> => ({
    statusCode: ResetStatusCode.Invalid,
  }),
};

export default AuthClient;
