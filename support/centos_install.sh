#!/bin/bash
#fail-fast
set -euo pipefail

if [ `whoami` != 'root' ];then
 echo "You must be root to execute this script."
 exit 1
fi

# Change into parent directory of this script
cd `dirname "$0"`
echo "Running script from within `pwd`"

echo "Installing dependencies for rb2-migrate..."

echo "Ensuring there are no current yarn installations..."
which yarn && exit 1
echo "Ensuring there are no current node installations..."
which node && exit 1
which nvm && exit 1

echo "Installing yarn..."
curl --silent --location https://dl.yarnpkg.com/rpm/yarn.repo | sudo tee /etc/yum.repos.d/yarn.repo || exit 1
 yum -y install yarn

echo "Installing nvm..."
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash || exit 1
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

echo "Installing node..."
nvm install node --lts || exit 1

echo "Installing dependencies for building native modules if needed..."
sudo yum -y install gcc-c++ make || exit 1

echo "Installing graphviz (dot) for rendering graphs..."
sudo yum -y install graphviz
ln -s /bin/dot /usr/local/bin/
