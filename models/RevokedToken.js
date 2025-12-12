import { DataTypes } from 'sequelize';
import { getSequelize } from '../config/database.js';
import { t } from '../config/i18n.js';
import { logger } from '../config/logger.js';

let RevokedToken;

export const initializeRevokedTokenModel = () => {
  const sequelize = getSequelize();

  RevokedToken = sequelize.define(
    'RevokedToken',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      jti: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'JWT ID from the revoked token',
      },
      sub: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Subject claim from the JWT (user identifier)',
      },
      sid: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Session ID from the OIDC ID token',
      },
      exp: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Expiration time of the revoked token',
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when the token was revoked (null if not revoked)',
      },
      revocation_reason: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Reason for revocation (e.g., backchannel_logout, user_initiated)',
      },
    },
    {
      tableName: 'revoked_tokens',
      timestamps: false,
      indexes: [
        {
          fields: ['jti'],
          unique: true,
        },
        {
          fields: ['sub'],
        },
        {
          fields: ['sid'],
        },
        {
          fields: ['exp'],
        },
      ],
    }
  );

  return RevokedToken;
};

export const getRevokedTokenModel = () => {
  if (!RevokedToken) {
    throw new Error('RevokedToken model not initialized');
  }
  return RevokedToken;
};

export const cleanupExpiredTokens = async () => {
  const RevokedTokenModel = getRevokedTokenModel();
  const now = new Date();

  const deleted = await RevokedTokenModel.destroy({
    where: {
      exp: {
        [DataTypes.Op.lt]: now,
      },
    },
  });

  if (deleted > 0) {
    logger.info(t('tokens.cleanedExpired', { count: deleted }));
  }

  return deleted;
};
