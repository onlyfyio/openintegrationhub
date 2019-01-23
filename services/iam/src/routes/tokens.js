const express = require('express');
const bodyParser = require('body-parser');
const Logger = require('@basaas/node-logger');

const router = express.Router();

const CONF = require('./../conf');
const CONSTANTS = require('./../constants');
const { PERMISSIONS, RESTRICTED_PERMISSIONS } = require('./../access-control/permissions');
const auth = require('./../util/auth');
const TokenDAO = require('./../dao/tokens');
const AccountDAO = require('../dao/accounts');
const TokenUtils = require('./../util/tokens');

const log = Logger.getLogger(`${CONF.general.loggingNameSpace}/token`, {
    level: 'debug',
});
const auditLog = Logger.getAuditLogger(`${CONF.general.loggingNameSpace}/token-router`);

/**
 * Get all Tokens
 */
router.get('/', auth.isAdmin, async (req, res, next) => {

    const query = {};

    if (req.query.tokenId) {
        query.tokenId = req.query.tokenId;
    }

    try {
        const docs = await TokenDAO.find(query);
        return res.send(docs);
    } catch (err) {
        return next({ status: 500, message: CONSTANTS.ERROR_CODES.DEFAULT });
    }
});

/**
 * Create a new token
 * */
router.post('/', auth.can([RESTRICTED_PERMISSIONS['iam.token.create']]), async (req, res, next) => {

    const account = await AccountDAO.findOne({ _id: req.body.accountId, status: CONSTANTS.STATUS.ACTIVE });
    const tokenLifespan = req.body.expiresIn;

    if (!account) {
        // User is either disabled or does not exist anymore
        return next({ status: 403, message: CONSTANTS.ERROR_CODES.FORBIDDEN });
    }

    if (req.body.customPermissions && !auth.hasPermissions({
        user: req.user,
        requiredPermissions: [RESTRICTED_PERMISSIONS['iam.token.update']],
    })) {
        return next({ status: 403, message: CONSTANTS.ERROR_CODES.FORBIDDEN });
    }

    if (!req.body.inquirer) {
        return next({ status: 400, message: 'Missing inquirer' });
    }

    const token = await TokenUtils.sign({
        ...account,
        purpose: req.body.purpose || 'accountToken',
        initiator: req.user.userid,
        inquirer: req.body.inquirer,
        accountId: account._id.toString(),
        description: req.body.description || '',
        permissions: Array.from(new Set((account.permissions || []).concat(req.body.customPermissions || []))),
    }, {
        type: tokenLifespan === -1 ? CONSTANTS.TOKEN_TYPES.PERSISTENT : CONSTANTS.TOKEN_TYPES.EPHEMERAL_SERVICE_ACCOUNT,
        lifespan: tokenLifespan,
        new: req.body.new, // return an existing token if new != true
    });

    auditLog.info('token.create', {
        data: req.body,
        accountId: req.user.userid,
        'x-request-id': req.headers['x-request-id'],
    });

    res.status(200).send({ token });
});

/**
 * Get all Tokens
 */
router.post('/introspect', auth.can([RESTRICTED_PERMISSIONS['iam.token.introspect']]), async (req, res, next) => {
    try {
        const accountData = await TokenUtils.getAccountData(req.body.token);

        if (accountData) {
            auditLog.info('iam.token.introspect', {
                token: req.body.token.replace(/.(?=.{4,}$)/g, '*'),
                accountId: req.user.userid,
                'x-request-id': req.headers['x-request-id'],
            });
            return res.send(accountData);
        } else {
            return res.sendStatus(404);
        }

    } catch (err) {
        console.log(err);
        return next({ status: 500, message: CONSTANTS.ERROR_CODES.DEFAULT });
    }
});

/**
 * Get & refresh my token
 */
router.get('/refresh', async (req, res, next) => {

    try {
        const newToken = await TokenUtils.fetchAndProlongToken(req.user.tokenId);

        if (newToken) {
            auditLog.info('token.refresh', {
                newToken: newToken.tokenId.replace(/.(?=.{4,}$)/g, '*'),
                accountId: req.user.userid,
                'x-request-id': req.headers['x-request-id'],
            });
            req.headers.authorization = `Bearer ${newToken.tokenId}`;
            return res.send({ token: newToken.tokenId });
        } else {
            return next({ status: 401, message: CONSTANTS.ERROR_CODES.SESSION_EXPIRED });
        }

    } catch (err) {
        return next({ status: 500, message: CONSTANTS.ERROR_CODES.DEFAULT });
    }
});

/**
 * Get token by id
 */
router.get('/:id', auth.isAdmin, async (req, res, next) => {

    try {
        const doc = await TokenDAO.find({ _id: req.params.id });
        if (!doc) {
            return res.sendStatus(404);
        } else {
            return res.send(doc[0]);
        }

    } catch (err) {
        return next({ status: 500, message: CONSTANTS.ERROR_CODES.DEFAULT });
    }
});

/**
 * Delete a token
 */
router.delete('/:id', auth.can([RESTRICTED_PERMISSIONS['iam.token.delete']]), async (req, res, next) => {

    try {
        await TokenDAO.delete({ id: req.params.id });
        auditLog.info('iam.token.delete', {
            token: req.params.id,
            accountId: req.user.userid,
            'x-request-id': req.headers['x-request-id'],
        });
        return res.sendStatus(200);
    } catch (err) {
        log.error(err);
        return next({ status: 500, message: CONSTANTS.ERROR_CODES.DEFAULT });
    }
});

module.exports = router;