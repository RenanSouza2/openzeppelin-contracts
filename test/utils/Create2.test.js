const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { balance, ether, expectEvent, expectRevert, send } = require('@openzeppelin/test-helpers');
const { expectRevertCustomError } = require('../helpers/customError');

const Create2 = '$Create2';
const VestingWallet = 'VestingWallet';
// This should be a contract that:
// - has no constructor arguments
// - has no immutable variable populated during construction
const ConstructorLessContract = Create2;

async function fixture() {
  const [deployerAccount, other] = await ethers.getSigners();

  const factory = await ethers.deployContract(Create2);
  const encodedParams = ethers.AbiCoder.defaultAbiCoder()
    .encode(['address', 'uint64', 'uint64'], [other.address, 0, 0])
    .slice(2);

  const VestingWalletFactory = await ethers.getContractFactory(VestingWallet);
  const constructorByteCode = `${VestingWalletFactory.bytecode}${encodedParams}`;

  return { deployerAccount, other, factory, encodedParams, constructorByteCode };
}

describe.only('Create2', function () {
  const salt = 'salt message';
  const saltHex = ethers.id(salt);

  beforeEach(async function () {
    Object.assign(this, await loadFixture(fixture));
  });

  describe('computeAddress', function () {
    it.only('computes the correct contract address', async function () {
      const onChainComputed = await this.factory.$computeAddress(saltHex, ethers.keccak256(this.constructorByteCode));
      const offChainComputed = ethers.getCreate2Address(
        this.factory.target,
        saltHex,
        ethers.keccak256(this.constructorByteCode),
      );
      expect(onChainComputed).to.equal(offChainComputed);
    });

    it('computes the correct contract address with deployer', async function () {
      const onChainComputed = await this.factory.$computeAddress(
        saltHex,
        web3.utils.keccak256(constructorByteCode),
        deployerAccount,
      );
      const offChainComputed = ethers.getCreate2Address(
        deployerAccount,
        saltHex,
        ethers.keccak256(constructorByteCode),
      );
      expect(onChainComputed).to.equal(offChainComputed);
    });
  });

  describe('deploy', function () {
    it('deploys a contract without constructor', async function () {
      const offChainComputed = ethers.getCreate2Address(
        this.factory.address,
        saltHex,
        ethers.keccak256(ConstructorLessContract.bytecode),
      );

      expectEvent(await this.factory.$deploy(0, saltHex, ConstructorLessContract.bytecode), 'return$deploy', {
        addr: offChainComputed,
      });

      expect(ConstructorLessContract.bytecode).to.include((await web3.eth.getCode(offChainComputed)).slice(2));
    });

    it('deploys a contract with constructor arguments', async function () {
      const offChainComputed = ethers.getCreate2Address(
        this.factory.address,
        saltHex,
        ethers.keccak256(constructorByteCode),
      );

      expectEvent(await this.factory.$deploy(0, saltHex, constructorByteCode), 'return$deploy', {
        addr: offChainComputed,
      });

      const instance = await VestingWallet.at(offChainComputed);

      expect(await instance.owner()).to.be.equal(other);
    });

    it('deploys a contract with funds deposited in the factory', async function () {
      const deposit = ether('2');
      await send.ether(deployerAccount, this.factory.address, deposit);
      expect(await balance.current(this.factory.address)).to.be.bignumber.equal(deposit);

      const offChainComputed = ethers.getCreate2Address(
        this.factory.address,
        saltHex,
        ethers.keccak256(constructorByteCode),
      );

      expectEvent(await this.factory.$deploy(deposit, saltHex, constructorByteCode), 'return$deploy', {
        addr: offChainComputed,
      });

      expect(await balance.current(offChainComputed)).to.be.bignumber.equal(deposit);
    });

    it('fails deploying a contract in an existent address', async function () {
      expectEvent(await this.factory.$deploy(0, saltHex, constructorByteCode), 'return$deploy');

      // TODO: Make sure it actually throws "Create2FailedDeployment".
      // For some unknown reason, the revert reason sometimes return:
      // `revert with unrecognized return data or custom error`
      await expectRevert.unspecified(this.factory.$deploy(0, saltHex, constructorByteCode));
    });

    it('fails deploying a contract if the bytecode length is zero', async function () {
      await expectRevertCustomError(this.factory.$deploy(0, saltHex, '0x'), 'Create2EmptyBytecode', []);
    });

    it('fails deploying a contract if factory contract does not have sufficient balance', async function () {
      await expectRevertCustomError(
        this.factory.$deploy(1, saltHex, constructorByteCode),
        'Create2InsufficientBalance',
        [0, 1],
      );
    });
  });
});
