export class InvalidAddressError extends Error {
  constructor(message = 'Invalid Ethereum address format') {
    super(message);
    this.name = 'InvalidAddressError';
  }
}

export class RPCError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'RPCError';
    this.code = code;
  }
}

export class RPCTimeoutError extends Error {
  constructor(message = 'RPC request timed out') {
    super(message);
    this.name = 'RPCTimeoutError';
  }
}

export class RPCParseError extends Error {
  constructor(message = 'Failed to parse RPC response') {
    super(message);
    this.name = 'RPCParseError';
  }
}

export class RPCResponseRangeError extends Error {
  constructor(message = 'RPC response value out of valid range') {
    super(message);
    this.name = 'RPCResponseRangeError';
  }
}
