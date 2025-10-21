declare module 'flutterwave-node-v3' {
  interface FlutterwaveResponse {
    status: string;
    message: string;
    data: any;
  }

  export default class Flutterwave {
    constructor(publicKey: string, secretKey: string, production?: boolean);
    
    Charge: {
      initialize(payload: any): Promise<FlutterwaveResponse>;
    };
    
    Transaction: {
      verify(payload: { id?: string; tx_ref?: string }): Promise<FlutterwaveResponse>;
    };
    
    Banks: {
      country(countryCode: string): Promise<FlutterwaveResponse>;
    };
  }
}