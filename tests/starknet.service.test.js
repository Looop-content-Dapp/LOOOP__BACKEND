import { Provider, Contract, Account, ec, stark, uint256, shortString } from 'starknet';
import StarknetService from '../services/starknet.service.js';
import { User } from '../models/user.model.js';

// Mock the starknet.js library
jest.mock('starknet', () => {
  const mockProvider = {
    getTransaction: jest.fn(),
    getTransactionReceipt: jest.fn(),
    getBlock: jest.fn(),
    waitForTransaction: jest.fn(),
  };

  const mockContract = {
    call: jest.fn(),
    invoke: jest.fn(),
    connect: jest.fn(),
  };

  return {
    Provider: jest.fn(() => mockProvider),
    Contract: jest.fn(() => mockContract),
    Account: jest.fn(),
    ec: {
      getKeyPair: jest.fn(),
      getStarkKey: jest.fn(),
      starkCurve: {
        randomPrivateKey: jest.fn(),
        getStarkKey: jest.fn(),
      },
    },
    stark: {
      randomAddress: jest.fn(),
    },
    uint256: {
      uint256ToBN: jest.fn(),
    },
    shortString: {
      encodeShortString: jest.fn(),
      decodeShortString: jest.fn(),
    },
    CallData: {
      compile: jest.fn(),
    },
    constants: {},
  };
});

// Mock the User model
jest.mock('../models/user.model.js', () => ({
  User: {
    findOne: jest.fn(),
  },
}));

describe('StarknetService', () => {
  let starknetService;
  let mockProvider;
  let mockContract;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create a new instance of StarknetService
    starknetService = new StarknetService();

    // Get references to the mocked objects
    mockProvider = starknetService.provider;
    mockContract = new Contract();
  });

  describe('getContract', () => {
    it('should return a contract instance', () => {
      const contractAddress = '0x123';
      const abi = { functions: [] };

      const contract = starknetService.getContract(contractAddress, abi);

      expect(Contract).toHaveBeenCalledWith(abi, contractAddress, mockProvider);
      expect(contract).toBeDefined();
    });
  });

  describe('getAccount', () => {
    it('should return an account instance', () => {
      const privateKey = '0x456';
      const accountAddress = '0x789';

      const account = starknetService.getAccount(privateKey, accountAddress);

      expect(Account).toHaveBeenCalledWith(mockProvider, accountAddress, privateKey);
      expect(account).toBeDefined();
    });
  });

  describe('callContract', () => {
    it('should call a read-only method on a contract', async () => {
      const contractAddress = '0x123';
      const abi = { functions: [] };
      const method = 'balanceOf';
      const calldata = ['0x456'];
      const expectedResult = { balance: '100' };

      mockContract.call.mockResolvedValue(expectedResult);

      const result = await starknetService.callContract(contractAddress, abi, method, calldata);

      expect(Contract).toHaveBeenCalledWith(abi, contractAddress, mockProvider);
      expect(mockContract.call).toHaveBeenCalledWith(method, calldata);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors when calling a contract method', async () => {
      const contractAddress = '0x123';
      const abi = { functions: [] };
      const method = 'balanceOf';
      const calldata = ['0x456'];
      const error = new Error('Contract call failed');

      mockContract.call.mockRejectedValue(error);

      await expect(starknetService.callContract(contractAddress, abi, method, calldata))
        .rejects.toThrow(error);

      expect(Contract).toHaveBeenCalledWith(abi, contractAddress, mockProvider);
      expect(mockContract.call).toHaveBeenCalledWith(method, calldata);
    });
  });

  describe('executeTransaction', () => {
    it('should execute a transaction on a contract', async () => {
      const contractAddress = '0x123';
      const abi = { functions: [] };
      const method = 'transfer';
      const calldata = ['0x456', '100'];
      const account = {};
      const txHash = '0xabc';
      const receipt = { status: 'ACCEPTED_ON_L2' };

      mockContract.invoke.mockResolvedValue({ transaction_hash: txHash });
      mockProvider.waitForTransaction.mockResolvedValue(receipt);

      const result = await starknetService.executeTransaction(contractAddress, abi, method, calldata, account);

      expect(Contract).toHaveBeenCalledWith(abi, contractAddress, mockProvider);
      expect(mockContract.connect).toHaveBeenCalledWith(account);
      expect(mockContract.invoke).toHaveBeenCalledWith(method, calldata);
      expect(mockProvider.waitForTransaction).toHaveBeenCalledWith(txHash);
      expect(result).toEqual({
        transactionHash: txHash,
        receipt,
      });
    });

    it('should handle errors when executing a transaction', async () => {
      const contractAddress = '0x123';
      const abi = { functions: [] };
      const method = 'transfer';
      const calldata = ['0x456', '100'];
      const account = {};
      const error = new Error('Transaction failed');

      mockContract.invoke.mockRejectedValue(error);

      await expect(starknetService.executeTransaction(contractAddress, abi, method, calldata, account))
        .rejects.toThrow(error);

      expect(Contract).toHaveBeenCalledWith(abi, contractAddress, mockProvider);
      expect(mockContract.connect).toHaveBeenCalledWith(account);
      expect(mockContract.invoke).toHaveBeenCalledWith(method, calldata);
    });
  });

  describe('getTransactionStatus', () => {
    it('should get transaction status', async () => {
      const txHash = '0xabc';
      const expectedTx = { status: 'ACCEPTED_ON_L2' };

      mockProvider.getTransaction.mockResolvedValue(expectedTx);

      const result = await starknetService.getTransactionStatus(txHash);

      expect(mockProvider.getTransaction).toHaveBeenCalledWith(txHash);
      expect(result).toEqual(expectedTx);
    });

    it('should handle errors when getting transaction status', async () => {
      const txHash = '0xabc';
      const error = new Error('Transaction not found');

      mockProvider.getTransaction.mockRejectedValue(error);

      await expect(starknetService.getTransactionStatus(txHash))
        .rejects.toThrow(error);

      expect(mockProvider.getTransaction).toHaveBeenCalledWith(txHash);
    });
  });

  describe('getTransactionReceipt', () => {
    it('should get transaction receipt', async () => {
      const txHash = '0xabc';
      const expectedReceipt = { status: 'ACCEPTED_ON_L2' };

      mockProvider.getTransactionReceipt.mockResolvedValue(expectedReceipt);

      const result = await starknetService.getTransactionReceipt(txHash);

      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);
      expect(result).toEqual(expectedReceipt);
    });

    it('should handle errors when getting transaction receipt', async () => {
      const txHash = '0xabc';
      const error = new Error('Receipt not found');

      mockProvider.getTransactionReceipt.mockRejectedValue(error);

      await expect(starknetService.getTransactionReceipt(txHash))
        .rejects.toThrow(error);

      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);
    });
  });

  describe('getBlock', () => {
    it('should get block information', async () => {
      const blockIdentifier = 123;
      const expectedBlock = { block_number: 123, timestamp: 1234567890 };

      mockProvider.getBlock.mockResolvedValue(expectedBlock);

      const result = await starknetService.getBlock(blockIdentifier);

      expect(mockProvider.getBlock).toHaveBeenCalledWith(blockIdentifier);
      expect(result).toEqual(expectedBlock);
    });

    it('should handle errors when getting block information', async () => {
      const blockIdentifier = 123;
      const error = new Error('Block not found');

      mockProvider.getBlock.mockRejectedValue(error);

      await expect(starknetService.getBlock(blockIdentifier))
        .rejects.toThrow(error);

      expect(mockProvider.getBlock).toHaveBeenCalledWith(blockIdentifier);
    });
  });

  describe('generateKeyPair', () => {
    it('should generate a key pair using getKeyPair', () => {
      const privateKey = '0x123';
      const keyPair = {};
      const publicKey = '0x456';

      stark.randomAddress.mockReturnValue(privateKey);
      ec.getKeyPair.mockReturnValue(keyPair);
      ec.getStarkKey.mockReturnValue(publicKey);

      const result = starknetService.generateKeyPair();

      expect(stark.randomAddress).toHaveBeenCalled();
      expect(ec.getKeyPair).toHaveBeenCalledWith(privateKey);
      expect(ec.getStarkKey).toHaveBeenCalledWith(keyPair);
      expect(result).toEqual({ privateKey, publicKey });
    });

    it('should handle errors when generating a key pair', () => {
      const error = new Error('Failed to generate key pair');

      stark.randomAddress.mockImplementation(() => {
        throw error;
      });

      const result = starknetService.generateKeyPair();

      expect(result).toBeUndefined();
    });
  });

  describe('stringToFelt', () => {
    it('should convert a string to felt', () => {
      const str = 'Hello';
      const felt = '0x123';

      shortString.encodeShortString.mockReturnValue(felt);

      const result = starknetService.stringToFelt(str);

      expect(shortString.encodeShortString).toHaveBeenCalledWith(str);
      expect(result).toEqual(felt);
    });
  });

  describe('feltToString', () => {
    it('should convert a felt to string', () => {
      const felt = '0x123';
      const str = 'Hello';

      shortString.decodeShortString.mockReturnValue(str);

      const result = starknetService.feltToString(felt);

      expect(shortString.decodeShortString).toHaveBeenCalledWith(felt);
      expect(result).toEqual(str);
    });
  });

  describe('parseUint256', () => {
    it('should parse uint256 value', () => {
      const uint256Value = { low: '100', high: '0' };
      const parsedValue = '100';
      const bnValue = { toString: jest.fn().mockReturnValue(parsedValue) };

      uint256.uint256ToBN.mockReturnValue(bnValue);

      const result = starknetService.parseUint256(uint256Value);

      expect(uint256.uint256ToBN).toHaveBeenCalledWith(uint256Value);
      expect(bnValue.toString).toHaveBeenCalled();
      expect(result).toEqual(parsedValue);
    });
  });

  describe('createUserWallet', () => {
    it('should create a Starknet wallet for a user', async () => {
      const email = 'user@example.com';
      const privateKey = '0x123';
      const publicKey = '0x456';
      const user = {
        wallets: {},
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(user);

      // Mock the generateKeyPair method
      jest.spyOn(starknetService, 'generateKeyPair').mockReturnValue({ privateKey, publicKey });

      const result = await starknetService.createUserWallet(email);

      expect(User.findOne).toHaveBeenCalledWith({ email });
      expect(starknetService.generateKeyPair).toHaveBeenCalled();
      expect(user.wallets.starknet).toEqual({
        address: publicKey,
        privateKey: privateKey,
        balance: 0,
      });
      expect(user.save).toHaveBeenCalled();
      expect(result).toEqual({
        address: publicKey,
        privateKey: privateKey,
      });
    });

    it('should handle errors when creating a user wallet', async () => {
      const email = 'user@example.com';
      const error = new Error('User not found');

      User.findOne.mockRejectedValue(error);

      await expect(starknetService.createUserWallet(email))
        .rejects.toThrow(error);

      expect(User.findOne).toHaveBeenCalledWith({ email });
    });
  });

  describe('getTransactionDetails', () => {
    it('should get comprehensive transaction details', async () => {
      const txHash = '0xabc';
      const transaction = { block_number: 123 };
      const receipt = {
        status: 'ACCEPTED_ON_L2',
        execution_status: 'SUCCEEDED',
        finality_status: 'ACCEPTED_ON_L2',
        events: [{ data: ['0x1', '0x2'] }]
      };
      const blockInfo = { timestamp: 1234567890 };

      mockProvider.getTransaction.mockResolvedValue(transaction);
      mockProvider.getTransactionReceipt.mockResolvedValue(receipt);
      mockProvider.getBlock.mockResolvedValue(blockInfo);

      const result = await starknetService.getTransactionDetails(txHash);

      expect(mockProvider.getTransaction).toHaveBeenCalledWith(txHash);
      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);
      expect(mockProvider.getBlock).toHaveBeenCalledWith(transaction.block_number);
      expect(result).toEqual({
        transaction,
        receipt,
        blockInfo,
        status: receipt.status,
        executionStatus: receipt.execution_status,
        finalityStatus: receipt.finality_status,
        timestamp: blockInfo.timestamp,
        events: receipt.events,
      });
    });

    it('should handle transaction not included in a block', async () => {
      const txHash = '0xabc';
      const transaction = { block_number: null };
      const receipt = {
        status: 'RECEIVED',
        execution_status: null,
        finality_status: null,
        events: []
      };

      mockProvider.getTransaction.mockResolvedValue(transaction);
      mockProvider.getTransactionReceipt.mockResolvedValue(receipt);

      const result = await starknetService.getTransactionDetails(txHash);

      expect(mockProvider.getTransaction).toHaveBeenCalledWith(txHash);
      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);
      expect(mockProvider.getBlock).not.toHaveBeenCalled();
      expect(result).toEqual({
        transaction,
        receipt,
        blockInfo: null,
        status: receipt.status,
        executionStatus: receipt.execution_status,
        finalityStatus: receipt.finality_status,
        timestamp: null,
        events: receipt.events,
      });
    });

    it('should handle errors when getting transaction details', async () => {
      const txHash = '0xabc';
      const error = new Error('Transaction not found');

      mockProvider.getTransaction.mockRejectedValue(error);

      await expect(starknetService.getTransactionDetails(txHash))
        .rejects.toThrow(error);

      expect(mockProvider.getTransaction).toHaveBeenCalledWith(txHash);
    });
  });
});
