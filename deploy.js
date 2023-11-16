const {
    Client,
    AccountId,
    PrivateKey,
    TokenAssociateTransaction,
    AccountCreateTransaction,
    ContractCreateFlow,
    ContractExecuteTransaction,
    ContractFunctionParameters,
    TokenId,
    TransactionRecordQuery,
    AccountBalanceQuery,
    Hbar,
} = require("@hashgraph/sdk");
const fs = require("fs");

require("dotenv").config();

const accountIdTest = AccountId.fromString(process.env.OPERATOR_ID); //INHERITS FROM THE .env FILE
const accountKeyTest = PrivateKey.fromString(process.env.OPERATOR_KEY); //INHERITS FROM THE .env FILE


const tokenToAssociate = "0.0.*******"; //AFTER DEPLOYING YOUR CONTRACT, INPUT THE TOKEN iD HERE
const accountToAssociate = "0.0.*******"; //CONTAINS THE ACCOUNT ID, GOTTEN FROM THE ACCOUNT YOU OPENED

// importing operator from .env file


const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY);
const operatorId = AccountId.fromString(process.env.OPERATOR_ID);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

// Account creation function
async function accountCreator(pvKey, iBal) {
    const response = await new AccountCreateTransaction()
        .setInitialBalance(new Hbar(iBal))
        .setKey(pvKey.publicKey)
        .execute(client);

    const receipt = await response.getReceipt(client);

    return receipt.accountId;
}
const main = async () => {
    try {
        // Created a treasury account
        const treasuryKey = PrivateKey.fromString("***********************************************"); //INPUT TREASURY KEY HERE 
        const treasuryId = await accountCreator(treasuryKey, 10);

        // Load contract bytecode
        const bytecode = fs.readFileSync("./binaries/TokenCreator_sol_TokenCreator.bin"); // THIS FILE IS CREATED AFTER RUNNING THIS COMMAND :solcjs --bin LookupContract.sol

        // Create a smart contract
        const createContract = new ContractCreateFlow()
            .setGas(200000) // Adjust gas if needed
            .setBytecode(bytecode);
        const createContractTx = await createContract.execute(client);
        const createContractRx = await createContractTx.getReceipt(client);
        const contractId = createContractRx.contractId;

        console.log(`Contract created with ID: ${contractId}`);

        // Create a fungible token using the smart contract
        const createToken = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(200000)
            .setPayableAmount(30) // i Adjusted payable amount to 30
            .setFunction(
                "createFungible",
                new ContractFunctionParameters()
                    .addString("TOKEN NAME") // ENSURE TO REPLACE WITH YOUR TOKEN NAME
                    .addString("TICKER") //TOKEN
                    .addUint256(1000000000)
                    .addUint256(2)
                    .addUint32(7000000)
            );

        const createTokenTx = await createToken.execute(client);
        const createTokenRx = await createTokenTx.getRecord(client);
        const tokenIdSolidityAddr = createTokenRx.contractFunctionResult.getAddress(0);
        const tokenId = AccountId.fromSolidityAddress(tokenIdSolidityAddr);

        console.log(`Token created with ID: ${tokenId}`);

        // Associate the token with an account using the HTS contract
        const transaction = await new TokenAssociateTransaction()
            .setAccountId(AccountId.fromString(accountToAssociate))
            .setTokenIds([TokenId.fromString(tokenToAssociate)])
            .freezeWith(client);

        // Sign and execute the transaction
        const signedTx = await transaction.sign(accountKeyTest);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);
        const transactionStatus = receipt.status;

        console.log("The transaction consensus status: " + transactionStatus);

        // Fetch additional information
        const childRecords = (await new TransactionRecordQuery()
            .setIncludeChildren(true)
            .setTransactionId(transaction.transactionId)
            .setQueryPayment(new Hbar(10))
            .execute(client)).children;

        console.log("The transaction record for the associate transaction: " + JSON.stringify(childRecords));

        const accountBalance = await new AccountBalanceQuery()
            .setAccountId(accountIdTest)
            .execute(client);

        console.log("The " + tokenId + " should now be associated with my account: " + accountBalance.tokens.toString());

        //TRANSFER THE TOKEN FROM ACCT1 TO ACCT2
        // Create the transfer transaction
        const transferTransaction = new TransferTransaction()
            .addTokenTransfer(TokenId.fromString(tokenToAssociate), AccountId.fromString(accountToAssociate), -10)
            .addTokenTransfer(TokenId.fromString(tokenToAssociate), AccountId.fromString('0.0.*******'), 10)   //REPLACE THE STARRED WITH YOUR ACCOUNT ID

            .freezeWith(client);

        // Sign with the sender account private key
        const signedTransferTx = await transferTransaction.sign(senderPrivateKey);

        // Execute the signed transaction
        const transferTxResponse = await signedTransferTx.execute(client);

        // Request the receipt of the transaction
        const transferReceipt = await transferTxResponse.getReceipt(client);

        // Obtain the transaction consensus status
        const transferTransactionStatus = transferReceipt.status;

        console.log("The transaction consensus status: " + transferTransactionStatus);


    } catch (error) {
        console.error("An error occurred:", error);
    }
};


main();




