const userRepository = require('./user.repository');

module.exports = {
  findUserByEmailWithSecrets: email => userRepository.findByEmail(email, true),
  findByLoginIdentifier: identifier => userRepository.findByLoginIdentifier(identifier, true),
  findUserByIdWithSecrets: id => userRepository.findByIdWithSecrets(id),
  createUser: payload => userRepository.create(payload)
};
