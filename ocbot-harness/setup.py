from setuptools import setup, find_packages

setup(
    name='ocbot-cli',
    version='0.1.0',
    description='CLI harness for ocbot Web4 Agent',
    long_description=open('README.md').read() if __file__.endswith('setup.py') else '',
    long_description_content_type='text/markdown',
    packages=find_packages(),
    install_requires=[
        'click>=8.0',
    ],
    entry_points={
        'console_scripts': [
            'ocbot=ocbot.ocbot_cli:main',
        ],
    },
    python_requires='>=3.8',
)
