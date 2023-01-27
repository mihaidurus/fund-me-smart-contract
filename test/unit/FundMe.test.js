const { inputToConfig } = require("@ethereum-waffle/compiler")
const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
// tests will run only on our local hardhat network
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async () => {
          let fundMe
          let deployer
          let mockV3Aggregator
          const sendValue = ethers.utils.parseEther("0.1") // 1 ETH instead of  = 10000000000000000000
          beforeEach(async () => {
              // deploy our fundMe contract
              // using hardhat-deploy
              // const accounts = ethers.getNamedSigners()
              // const accountZero = accounts[0]
              deployer = (await getNamedAccounts()).deployer // grab just the deployer object and assigned it to the deployer var
              await deployments.fixture(["all"])
              fundMe = await ethers.getContract("FundMe")
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })
          describe("constructor", async () => {
              it("Sets the aggregator addresses correctly", async () => {
                  const response = await fundMe.getPriceFeed()
                  assert.equal(response, mockV3Aggregator.address)
              })
          })
          describe("fund", async () => {
              it("Fails if you dont send enough ETH", async () => {
                  // use to.be.revertedWith in order to check require statements or modifiers
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  )
              })
              it("update the amount funded data structure", async () => {
                  // call fund() from deployer and attach an ETH value to the transcation
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString()) // because we are working with big numbers we need to convert them to strings
              })
              it("Add funder the funding list", async () => {
                  await fundMe.fund({ value: sendValue })
                  const funderAddress = await fundMe.getFunder(0)
                  assert.equal(funderAddress, deployer)
              })
          })
          describe("withdraw", async () => {
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue })
              })
              it("Withdraw from a single funder", async () => {
                  // Arange
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)

                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  // const { ... } = var is used to grab objects from antoher object

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // gasCost
                  const gasCost = gasUsed.mul(effectiveGasPrice) // because both are big numbers we can use .mul()

                  // Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString(), // we use .toString() because starting fund me balance comes from the chain and is a big number
                      endingDeployerBalance.add(gasCost).toString()
                  )
              })

              it("Cheaper withdraw from a single funder", async () => {
                  // Arange
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  const transactionReceipt = await transactionResponse.wait(1)

                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  // const { ... } = var is used to grab objects from antoher object

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // gasCost
                  const gasCost = gasUsed.mul(effectiveGasPrice) // because both are big numbers we can use .mul()

                  // Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString(), // we use .toString() because starting fund me balance comes from the chain and is a big number
                      endingDeployerBalance.add(gasCost).toString()
                  )
              })

              it("Allows withdraw from multiple funders", async () => {
                  const accounts = await ethers.getSigners()
                  // at deployment only the deployer is attached to the contract so any call of fund()
                  // will be triggered from the deployer if we do not attach any other accounts
                  let fundMeConnectedContract
                  for (let i = 1; i < 6; i++) {
                      fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                  }
                  await fundMeConnectedContract.fund({ value: sendValue })

                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)

                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  // const { ... } = var is used to grab objects from antoher object

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // gasCost
                  const gasCost = gasUsed.mul(effectiveGasPrice) // because both are big numbers we can use .mul()

                  // Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString(), // we use .toString() because starting fund me balance comes from the chain and is a big number
                      endingDeployerBalance.add(gasCost).toString()
                  )
                  expect(fundMe.getFunder(0)).to.be.reverted
                  for (let i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })
              it("Only allows the owner to withdraw", async () => {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[1]
                  const attackerConnectedContract = await fundMe.connect(
                      attacker
                  )

                  await expect(
                      attackerConnectedContract.withdraw()
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
          })
          describe("Cheaper withdraw", async () => {
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue })
              })
              it("Withdraw from a single funder", async () => {
                  // Arange
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  const transactionReceipt = await transactionResponse.wait(1)

                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  // const { ... } = var is used to grab objects from antoher object

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // gasCost
                  const gasCost = gasUsed.mul(effectiveGasPrice) // because both are big numbers we can use .mul()

                  // Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString(), // we use .toString() because starting fund me balance comes from the chain and is a big number
                      endingDeployerBalance.add(gasCost).toString()
                  )
              })

              it("Allows withdraw from multiple funders", async () => {
                  const accounts = await ethers.getSigners()
                  // at deployment only the deployer is attached to the contract so any call of fund()
                  // will be triggered from the deployer if we do not attach any other accounts
                  let fundMeConnectedContract
                  for (let i = 1; i < 6; i++) {
                      fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                  }
                  await fundMeConnectedContract.fund({ value: sendValue })

                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  const transactionReceipt = await transactionResponse.wait(1)

                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  // const { ... } = var is used to grab objects from antoher object

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // gasCost
                  const gasCost = gasUsed.mul(effectiveGasPrice) // because both are big numbers we can use .mul()

                  // Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString(), // we use .toString() because starting fund me balance comes from the chain and is a big number
                      endingDeployerBalance.add(gasCost).toString()
                  )
                  expect(fundMe.getFunder(0)).to.be.reverted
                  for (let i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })
              it("Only allows the owner to withdraw", async () => {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[1]
                  const attackerConnectedContract = await fundMe.connect(
                      attacker
                  )

                  await expect(
                      attackerConnectedContract.cheaperWithdraw()
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
          })
      })
