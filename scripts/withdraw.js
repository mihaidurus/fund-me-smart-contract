const { getNamedAccounts, ethers } = require("hardhat")

async function main() {
    const deployer = (await getNamedAccounts()).deployer
    const fundMe = await ethers.getContract("FundMe", deployer)

    console.log("Funding contract ...")
    const fundingResponse = await fundMe.fund({
        value: ethers.utils.parseEther("1"),
    })
    await fundingResponse.wait(1)
    console.log(
        "Contract balance: ",
        (await ethers.provider.getBalance(fundMe.address)).toString()
    )

    const startOwnerBalance = await ethers.provider.getBalance(deployer)
    console.log(
        "Checking initial balance before withdraw:",
        startOwnerBalance.toString()
    )

    console.log("Withdrawing funds")
    const withdrawingResponse = await fundMe.withdraw()
    await withdrawingResponse.wait(1)

    const finalOwnerBalance = await ethers.provider.getBalance(deployer)
    console.log("Final balance:", finalOwnerBalance.toString())
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
